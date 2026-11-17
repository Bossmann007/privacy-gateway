import { describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/audit-log.js';
import type { SafeDTO } from '../src/domain/safe-dto.js';
import { serializeSafeDtoForMcp } from '../src/domain/safe-dto.js';
import { VirtualOffice } from '../src/office/virtual-office.js';
import { authorizeRelease } from '../src/policy/authorized-releases.js';
import {
  ADV,
  PlantedDeclassifier,
  PUBLIC_ERROR,
  mcpFor,
} from './helpers/adversarial-setup.js';

describe('hard exclusions and stable exception codes', () => {
  it('blocks an email planted in the summary', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          summary: 'contato cliente@exemplo.com no resumo',
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('cliente@exemplo.com');
  });

  it('blocks a BR phone planted in the summary', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          summary: 'ligar (41) 99999-0000',
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('99999-0000');
  });

  it('blocks OAB and CNJ shapes planted in the summary', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          summary: 'OAB/PR 12.345 no processo 0001234-56.2026.8.16.0001',
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('12.345');
    expect(out.content[0].text).not.toContain('0001234-56');
  });

  it('blocks a credential planted in the summary', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          summary: 'password=demo-secret',
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('demo-secret');
  });

  it('blocks a filesystem path planted in the summary', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          summary: 'see /srv/cases/raw.pdf',
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('/srv/cases');
  });

  it('blocks a stack trace planted in the summary', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          summary: 'stack at handler.ts:42',
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
    expect(out.content[0].text).not.toContain('handler.ts');
  });

  it('blocks a nested string above the field limit', () => {
    const mcp = mcpFor(
      ADV,
      new VirtualOffice({
        declassifier: new PlantedDeclassifier({
          decisions: [{ id: 'dec_1', text: 'x'.repeat(601) }],
        }),
      }),
    );
    const entered = mcp.callTool({
      name: 'enter_office',
      arguments: { caseId: 'case-banco-001' },
    });
    if (entered.isError) throw new Error('enter');
    const out = mcp.callTool({
      name: 'get_safe_summary',
      arguments: { sessionId: entered.structuredContent.sessionId },
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(PUBLIC_ERROR);
  });

  it('serialize throws a stable code and never interpolates the needle', () => {
    const dto: SafeDTO = {
      schemaVersion: '1',
      sessionId: 'ofs_abc123',
      releaseId: 'rel_abc123',
      summary: 'Cliente Joao da Silva no resumo.',
      decisions: [],
      tasks: [],
      safeReferences: [],
      warnings: [],
    };
    expect(() => serializeSafeDtoForMcp(dto)).toThrow(
      'SAFE_DTO_INVALID:forbidden_literal:0',
    );
    try {
      serializeSafeDtoForMcp(dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      expect(message).not.toContain('Joao da Silva');
    }
  });

  it('authorizeRelease stamps only allowlisted kinds and records the reason', () => {
    const audit = new AuditLog();
    const denied = authorizeRelease('not_a_template', 'x', 'CONFIDENTIAL', audit);
    expect(denied.declassified).toBe(false);
    expect(audit.all()[0]?.reason).toBe('CONFIDENTIAL->unauthorized_release');

    const stamped = authorizeRelease(
      'partner_brief',
      'x',
      'CONFIDENTIAL',
      audit,
      'socio-paulo',
    );
    expect(stamped.declassified).toBe(true);
    expect(audit.all()[1]?.reason).toBe(
      'CONFIDENTIAL->partner_brief:role_capped_partner_release',
    );
  });
});
