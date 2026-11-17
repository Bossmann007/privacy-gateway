# PROJECT.md

Project brain — semi-static. Update when stack or architecture changes.

## Stack

- Language: TypeScript (ESM, Node)
- Framework: none (library + MCP stdio server)
- Package manager: npm
- Runtime deps: `@modelcontextprotocol/sdk`
- Test/build: Vitest, `tsc`, `tsx`

## Commands

```bash
npm install
npm run typecheck
npm test
npm run demo
npm run mcp
npm run mcp:smoke
npm run evidence   # typecheck + test + demo + mcp:smoke
npm run lint:measure   # max-file-lines warn only (MAX_LINES=350)
```

## Architecture

Standalone sanitization / declassification gate, also shippable as a **Cursor plugin** (`.cursor-plugin/`, `mcp.json`, rules, skill). Product is validated `SafeDTO` egress over MCP — not a chatbot. External AI may receive only a SafeDTO; never raw context, DB, filesystem, or vector access. Four fail-closed egress layers: classification labels, taint provenance, typed presenter allowlist, independent byte firewall. Token redaction (`src/pii`) is an internal DLP stage; egress destroys information through declassification (`src/declassify`). Current write-up: `docs/architecture/privacy-gateway-v3.md`. Install plugin: `./scripts/install-plugin.sh` → `~/.cursor/plugins/local/privacy-gateway`.

## Conventions

- Privacy and professional secrecy are architecture requirements (deny-by-default, fail-closed).
- Describe technical controls; do not claim LGPD compliance.
- Prefer Portuguese in chat; code identifiers and file contents in English.
- Fictional case data only; no local model runtimes (e.g. Ollama) in this slice.
- Reimplement a security pattern in-repo before adding a dependency.
- MCP identity = connection principal (`OFFICE_USER_ID` / `OFFICE_ROLE`); tool args must not carry `user` or `role`.

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09 | SafeDTO-only egress over MCP | External AI is untrusted; raw office context never crosses the boundary |
| 2026-09 | Four-layer egress (labels, taint, presenter, byte firewall) | Fail-closed defense in depth; independent byte check after serialize |
| 2026-09 | TypeScript owns policy/audit/MCP; Python only if Presidio later | Thin vertical slice; avoid mixed runtime until needed |
| 2026-09 | Extracted standalone from openlegalai | Gate can evolve independently of the parent product |

## Known issues

- (none recorded)

## Current work

See `.cursor/state/checkpoint.json` for live task state.
