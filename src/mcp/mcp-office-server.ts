import { AuditLog } from '../audit/audit-log.js';
import type { SafeDTO } from '../domain/safe-dto.js';
import { serializeSafeDtoForMcp, validateSafeDto } from '../domain/safe-dto.js';
import { EgressFirewall } from '../firewall/egress-firewall.js';
import { VirtualOffice } from '../office/virtual-office.js';
import {
  argumentsCarryPrincipal,
  type ConnectionContext,
  PRINCIPAL_IN_ARGUMENTS,
} from './connection-context.js';
import {
  argumentsHaveUnknownKeys,
  UNKNOWN_ARGUMENT,
} from './tool-contract.js';

export type McpToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type McpToolResult =
  | {
      isError: false;
      structuredContent: SafeDTO;
      /** Wire bytes that would enter the external agent context. */
      content: [{ type: 'text'; text: string }];
    }
  | {
      isError: true;
      content: [{ type: 'text'; text: string }];
    };

export type McpOfficeServerArgs = {
  office?: VirtualOffice;
  connection: ConnectionContext;
  firewall?: EgressFirewall;
  onFirewallBlock?: (code: string) => void;
  audit?: AuditLog;
};

export class McpOfficeServer {
  private readonly office: VirtualOffice;
  private readonly connection: ConnectionContext;
  private readonly firewall: EgressFirewall;
  private readonly audit: AuditLog;
  private readonly onFirewallBlock?: (code: string) => void;

  constructor(args: McpOfficeServerArgs) {
    this.office = args.office ?? new VirtualOffice();
    this.connection = args.connection;
    this.firewall = args.firewall ?? new EgressFirewall();
    this.audit = args.audit ?? new AuditLog();
    this.onFirewallBlock = args.onFirewallBlock;
  }

  callTool(call: McpToolCall): McpToolResult {
    if (argumentsCarryPrincipal(call.arguments)) {
      this.audit.append({
        action: 'principal_in_arguments',
        userId: this.connection.principal.id,
        outcome: 'deny',
        reason: PRINCIPAL_IN_ARGUMENTS,
      });
      return publicError();
    }
    if (argumentsHaveUnknownKeys(call.name, call.arguments)) {
      this.audit.append({
        action: 'unknown_argument',
        userId: this.connection.principal.id,
        outcome: 'deny',
        reason: UNKNOWN_ARGUMENT,
      });
      return publicError();
    }

    const result = this.office.handleTool({
      toolName: call.name,
      user: this.connection.principal,
      caseId:
        typeof call.arguments.caseId === 'string'
          ? call.arguments.caseId
          : undefined,
      sessionId:
        typeof call.arguments.sessionId === 'string'
          ? call.arguments.sessionId
          : undefined,
      intent:
        typeof call.arguments.intent === 'string'
          ? call.arguments.intent
          : undefined,
    });

    if (!result.ok) {
      return publicError();
    }

    if (result.tool === 'enter_office' || result.tool === 'leave_office') {
      const lifecycle: SafeDTO = {
        schemaVersion: '1',
        sessionId: result.sessionId ?? 'ofs_none',
        releaseId: 'rel_session',
        summary:
          result.tool === 'enter_office'
            ? 'Office session opened. Private context remains server-side.'
            : 'Office session closed.',
        decisions: [],
        tasks: [],
        safeReferences: [],
        warnings: [
          {
            code: 'session_only',
            message: 'No case body released on session lifecycle tools.',
          },
        ],
      };
      return this.release(lifecycle);
    }

    if (!result.dto || !result.mcpBytes) {
      return publicError();
    }

    return this.release(result.dto, result.mcpBytes);
  }

  private release(dto: SafeDTO, expectedBytes?: string): McpToolResult {
    const checked = validateSafeDto(dto);
    if (!checked.ok) {
      return publicError();
    }
    let wire: string;
    try {
      wire = serializeSafeDtoForMcp(checked.dto);
    } catch {
      return publicError();
    }
    if (expectedBytes !== undefined && wire !== expectedBytes) {
      return publicError();
    }
    const verdict = this.firewall.inspect(wire);
    if (!verdict.ok) {
      this.onFirewallBlock?.(verdict.code);
      return publicError();
    }
    return {
      isError: false,
      structuredContent: checked.dto,
      content: [{ type: 'text', text: wire }],
    };
  }
}

function publicError(): McpToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: 'Requested resource could not be accessed.',
        }),
      },
    ],
  };
}
