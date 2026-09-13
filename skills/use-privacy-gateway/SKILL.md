---
name: use-privacy-gateway
description: Use Privacy Gateway MCP tools (enter_office, get_safe_summary, ask_office) and interpret SafeDTO egress. Use when the user works through the virtual office or asks for a safe case summary.
---

# Use Privacy Gateway

## Setup

Connection principal comes from plugin/env variables:

- `OFFICE_USER_ID` (example: `adv-ana`)
- `OFFICE_ROLE` (`advogado` | `socio` | `estagiario`)

Never put `user`, `userId`, `role`, or `principal` in tool arguments.

## Tool flow

1. `enter_office` with `{ "caseId": "<fixture-or-id>" }` — binds session; returns opaque `ofs_…` session id.
2. `get_safe_summary` or `ask_office` with `{ "sessionId": "ofs_…", "intent": "…" }` — returns a validated `SafeDTO` JSON string only.
3. `leave_office` with `{ "sessionId": "ofs_…" }` when done.

## SafeDTO shape

```ts
type SafeDTO = {
  schemaVersion: '1';
  sessionId: `ofs_${string}`;
  releaseId: `rel_${string}`;
  summary: string;
  decisions: SafeItem[];
  tasks: SafeTask[];
  safeReferences: SafeRef[];
  warnings: SafeWarning[];
};
```

Summarize from these fields only. Missing detail means the gate destroyed or withheld it — do not reconstruct PII.

## Demials

Public error text is intentionally vague. Do not probe for raw documents or alternate tools (`execute_sql`, `get_raw_document` are not available).

## Evidence (repo)

From the privacy-gateway checkout:

```bash
npm run evidence
```
