export type Role = 'socio' | 'advogado' | 'estagiario';

export type Classification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'STRICT';

const CLASSIFICATION_RANK: Record<Classification, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  STRICT: 3,
};

export function classificationRank(value: Classification): number {
  return CLASSIFICATION_RANK[value];
}

export function classificationOf(
  value: Classification | undefined,
): Classification {
  if (value === undefined || !(value in CLASSIFICATION_RANK)) {
    return 'STRICT';
  }
  return value;
}

export function maxClassification(
  a: Classification,
  b: Classification,
): Classification {
  return CLASSIFICATION_RANK[a] >= CLASSIFICATION_RANK[b] ? a : b;
}

export type UserPrincipal = {
  id: string;
  role: Role;
};

export type CaseField = {
  name: string;
  value: string;
  classification: Classification;
};

export type CaseDocument = {
  id: string;
  classification: Classification;
  fields: CaseField[];
};

export type CaseRecord = {
  id: string;
  title: string;
  allowedUserIds: string[];
  allowedRoles: Role[];
  documents: CaseDocument[];
};

/** High-side only. Never serialize across MCP. */
export type RawContext = {
  readonly __brand: 'raw';
  caseId: string;
  documents: CaseDocument[];
};

export type AuditEvent = {
  ts: string;
  action: string;
  userId: string;
  caseId?: string;
  sessionId?: string;
  outcome: 'allow' | 'deny';
  reason?: string;
};

export type PiiSpan = {
  start: number;
  end: number;
  type: string;
};

export const ALLOWLISTED_TOOLS = [
  'enter_office',
  'leave_office',
  'get_safe_summary',
  'ask_office',
] as const;

export type AllowlistedTool = (typeof ALLOWLISTED_TOOLS)[number];

export function isAllowlistedTool(name: string): name is AllowlistedTool {
  return (ALLOWLISTED_TOOLS as readonly string[]).includes(name);
}

export function asRawContext(
  caseId: string,
  documents: CaseDocument[],
): RawContext {
  return { __brand: 'raw', caseId, documents };
}

export const FORBIDDEN_MCP_KEYS = [
  'raw_messages',
  'raw_documents',
  'rag_chunks',
  'client_data',
  'cpf',
  'account_number',
  'credentials',
  'database_rows',
  'raw_agent_memory',
  'raw_session_context',
  'text',
  'answer',
] as const;
