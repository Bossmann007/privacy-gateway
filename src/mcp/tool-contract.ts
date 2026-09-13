import type { AllowlistedTool } from '../domain/types.js';
import { isAllowlistedTool } from '../domain/types.js';

export const UNKNOWN_ARGUMENT = 'UNKNOWN_ARGUMENT';

export const TOOL_ARGUMENT_KEYS: Record<AllowlistedTool, readonly string[]> = {
  enter_office: ['caseId'],
  leave_office: ['sessionId'],
  get_safe_summary: ['sessionId', 'intent'],
  ask_office: ['sessionId', 'intent'],
};

export function argumentsHaveUnknownKeys(
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  if (!isAllowlistedTool(toolName)) {
    return false;
  }
  const allowed = TOOL_ARGUMENT_KEYS[toolName];
  return Object.keys(args).some((key) => !allowed.includes(key));
}

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'text'],
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
  },
} as const;

export const SAFE_DTO_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'sessionId',
    'releaseId',
    'summary',
    'decisions',
    'tasks',
    'safeReferences',
    'warnings',
  ],
  properties: {
    schemaVersion: { type: 'string', const: '1' },
    sessionId: { type: 'string' },
    releaseId: { type: 'string' },
    summary: { type: 'string', maxLength: 600 },
    decisions: { type: 'array', maxItems: 5, items: ITEM_SCHEMA },
    tasks: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text', 'status'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          status: { type: 'string', enum: ['open', 'done'] },
        },
      },
    },
    safeReferences: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'kind'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'public_jurisprudence',
              'internal_case_ref',
              'workproduct_ref',
            ],
          },
        },
      },
    },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
} as const;

export const MCP_TOOLS = [
  {
    name: 'enter_office',
    description:
      'Open a server-side office session. Returns a SafeDTO with an opaque session id.',
    inputSchema: {
      type: 'object',
      properties: { caseId: { type: 'string' } },
      required: ['caseId'],
      additionalProperties: false,
    },
    outputSchema: SAFE_DTO_OUTPUT_SCHEMA,
  },
  {
    name: 'leave_office',
    description: 'Close an office session. Returns a SafeDTO ack.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
      additionalProperties: false,
    },
    outputSchema: SAFE_DTO_OUTPUT_SCHEMA,
  },
  {
    name: 'get_safe_summary',
    description:
      'Release a declassified SafeDTO for the session. Never returns raw case text.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        intent: { type: 'string' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    outputSchema: SAFE_DTO_OUTPUT_SCHEMA,
  },
  {
    name: 'ask_office',
    description:
      'Ask a question inside the office. The answer is a SafeDTO, not free text.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        intent: { type: 'string' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
    outputSchema: SAFE_DTO_OUTPUT_SCHEMA,
  },
] as const;
