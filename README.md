# Privacy Gateway

Mandatory privacy gateway for a private institutional legal office.

External AI is untrusted. It may receive only a validated `SafeDTO` across the MCP boundary. It never receives raw case context, database access, filesystem access, or vector access.

Token sanitization (deterministic Brazilian PII) is an internal DLP stage. Egress destroys information through declassification. Those are technical controls, not a legal-compliance claim.

Extracted from the `privacy-gateway/` slice of [Bossmann007/openlegalai](https://github.com/Bossmann007/openlegalai) so this gate can evolve on its own.

## Contract

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

Egress has four fail-closed layers: classification labels, taint provenance, a typed presenter allowlist, and an independent byte firewall.

MCP identity is the connection principal (`OFFICE_USER_ID` / `OFFICE_ROLE` on stdio). Tool arguments must not carry `user` or `role`.

## Layout

- `src/declassify` — SafeDTO builder (information-destroying)
- `src/pii` — deterministic BR DLP stage only
- `src/policy` — flow policy and role-thinned releases
- `src/firewall` — byte check after serialize
- `src/mcp` — stdio server and allowlist
- `src/office` — in-process virtual office
- `docs/architecture/privacy-gateway-v3.md` — current architecture
- `docs/architecture/privacy-gateway-v2.md` — DLP-stage notes

## Evidence

```bash
npm ci
npm run evidence
```

That runs typecheck, adversarial tests, the intern vs partner demo, and the MCP stdio smoke (`get_safe_summary` in one process).

## MCP stdio

```bash
npx @modelcontextprotocol/inspector --cli ./scripts/run-mcp.sh \
  --method tools/list \
  -e OFFICE_USER_ID=adv-ana \
  -e OFFICE_ROLE=advogado
```

Allowlist: `enter_office`, `leave_office`, `get_safe_summary`, `ask_office`.

Forbidden: `execute_sql`, `get_raw_document`, and any `user` / `role` key in tool arguments.

## Demo data

Fixtures are fictional. Do not add real client files.
