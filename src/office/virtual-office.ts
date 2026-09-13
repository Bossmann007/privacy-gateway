import { AuditLog } from '../audit/audit-log.js';
import { Declassifier } from '../declassify/declassifier.js';
import type { AllowlistedTool, UserPrincipal } from '../domain/types.js';
import { isAllowlistedTool } from '../domain/types.js';
import type { SafeDTO } from '../domain/safe-dto.js';
import { serializeSafeDtoForMcp } from '../domain/safe-dto.js';
import {
  OfficeSessionStore,
  type OfficeSession,
} from '../session/office-session-store.js';
import { CaseFixtureStore } from '../store/case-fixture-store.js';

export type OfficeResult =
  | { ok: true; tool: AllowlistedTool; dto?: SafeDTO; sessionId?: string; mcpBytes?: string }
  | { ok: false; reason: string };

export class VirtualOffice {
  private readonly store: CaseFixtureStore;
  private readonly sessions: OfficeSessionStore;
  private readonly declassifier: Declassifier;
  private readonly audit: AuditLog;

  constructor(opts?: {
    store?: CaseFixtureStore;
    sessions?: OfficeSessionStore;
    declassifier?: Declassifier;
    audit?: AuditLog;
  }) {
    this.store = opts?.store ?? CaseFixtureStore.fromDefaultFixture();
    this.sessions = opts?.sessions ?? new OfficeSessionStore();
    this.audit = opts?.audit ?? new AuditLog();
    this.declassifier =
      opts?.declassifier ?? new Declassifier({ audit: this.audit });
  }

  handleTool(args: {
    toolName: string;
    user: UserPrincipal;
    caseId?: string;
    sessionId?: string;
    intent?: string;
  }): OfficeResult {
    try {
      if (!isAllowlistedTool(args.toolName)) {
        this.audit.append({
          action: 'tool_denied',
          userId: args.user.id,
          outcome: 'deny',
          reason: 'tool_not_allowlisted',
        });
        return { ok: false, reason: 'tool_not_allowlisted' };
      }

      if (args.toolName === 'enter_office') {
        if (!args.caseId) {
          return { ok: false, reason: 'missing_case_id' };
        }
        const raw = this.store.getAuthorizedSummary(args.user, args.caseId);
        if (!raw) {
          this.audit.append({
            action: 'rbac_denied',
            userId: args.user.id,
            caseId: args.caseId,
            outcome: 'deny',
            reason: 'unauthorized_or_missing_classification',
          });
          return { ok: false, reason: 'unauthorized_or_missing_classification' };
        }
        const session = this.sessions.enter(args.user, args.caseId);
        this.audit.append({
          action: 'enter_office',
          userId: args.user.id,
          caseId: args.caseId,
          sessionId: session.id,
          outcome: 'allow',
        });
        return { ok: true, tool: 'enter_office', sessionId: session.id };
      }

      if (args.toolName === 'leave_office') {
        if (!args.sessionId) {
          return { ok: false, reason: 'invalid_session' };
        }
        const session = this.sessions.get(args.sessionId);
        if (!session) {
          return { ok: false, reason: 'invalid_session' };
        }
        const principal = this.resolvePrincipal(session, args.user);
        if (!principal.ok) {
          return principal;
        }
        this.sessions.leave(session.id);
        return { ok: true, tool: 'leave_office', sessionId: session.id };
      }

      if (
        args.toolName === 'get_safe_summary' ||
        args.toolName === 'ask_office'
      ) {
        if (!args.sessionId) {
          return { ok: false, reason: 'missing_session_id' };
        }
        const session = this.sessions.get(args.sessionId);
        if (!session) {
          return { ok: false, reason: 'invalid_session' };
        }
        const principal = this.resolvePrincipal(session, args.user);
        if (!principal.ok) {
          return principal;
        }
        const effective = principal.user;
        const raw = this.store.getAuthorizedSummary(effective, session.caseId);
        if (!raw) {
          return { ok: false, reason: 'unauthorized_or_missing_classification' };
        }

        this.audit.append({
          action: 'egress_intent',
          userId: effective.id,
          caseId: session.caseId,
          sessionId: session.id,
          outcome: 'allow',
          reason: args.toolName,
        });

        const dto = this.declassifier.declassify({
          raw,
          sessionId: session.id,
          role: effective.role,
          userId: effective.id,
          intent: args.intent,
        });
        const mcpBytes = serializeSafeDtoForMcp(dto);
        return {
          ok: true,
          tool: args.toolName,
          dto,
          sessionId: session.id,
          mcpBytes,
        };
      }

      return { ok: false, reason: 'unhandled_tool' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      if (message.startsWith('FORBIDDEN_STRING_IN_MCP_BYTES')) {
        throw err;
      }
      if (message === 'audit_write_failed' || message === 'audit_contains_cpf_shaped_data') {
        return { ok: false, reason: message };
      }
      return { ok: false, reason: 'Requested resource could not be accessed.' };
    }
  }

  private resolvePrincipal(
    session: OfficeSession,
    claimed: UserPrincipal,
  ): { ok: true; user: UserPrincipal } | { ok: false; reason: string } {
    if (session.userId !== claimed.id || session.role !== claimed.role) {
      this.audit.append({
        action: 'session_principal_mismatch',
        userId: session.userId,
        caseId: session.caseId,
        sessionId: session.id,
        outcome: 'deny',
        reason: 'SESSION_PRINCIPAL_MISMATCH',
      });
      return { ok: false, reason: 'SESSION_PRINCIPAL_MISMATCH' };
    }
    return { ok: true, user: { id: session.userId, role: session.role } };
  }
}
