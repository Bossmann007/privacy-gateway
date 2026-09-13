# Privacy Gateway

## Preferences

- Treat privacy and professional secrecy as architecture requirements (deny-by-default, fail-closed).
- Do not claim LGPD compliance. Describe technical controls. Leave legal or DPO judgment explicit.
- Prefer a thin vertical slice with adversarial evidence first.
- TypeScript owns policy, audit, and MCP orchestration. Python only if Presidio is added later.
- Reimplement a security pattern in-repo before adding a dependency.
- Use fictional case data only. Keep local model runtimes such as Ollama out of this slice.
- Prefer Portuguese in chat. Keep code identifiers and file contents in English.

## Facts

- This repo is the standalone sanitization / declassification gate. The product is `SafeDTO` egress, not a chatbot.
- External AI may receive only a validated SafeDTO. Never raw context, database, filesystem, or vector access.
- Token redaction is an internal DLP stage (`src/pii`). Egress must destroy information through declassification.
- `SafeDTO` carries opaque `ofs_` session ids and `rel_` release ids.
- Four egress layers: classification labels, taint provenance, typed presenter allowlist, independent byte firewall.
- MCP identity is the connection principal (`OFFICE_USER_ID` / `OFFICE_ROLE`). Tool arguments must not carry `user` or `role`.
- `npm run evidence` runs typecheck, tests, demo, and MCP stdio smoke.
- Current architecture: `docs/architecture/privacy-gateway-v3.md`.
- Cursor plugin install: `./scripts/install-plugin.sh` → `~/.cursor/plugins/local/privacy-gateway` (MCP + rules + skill).

## Learned User Preferences

## Learned Workspace Facts

## Agent skills

### Issue tracker

GitHub Issues via `gh` for this repo (`Bossmann007/privacy-gateway`). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/` (created lazily by domain-modeling). See `docs/agents/domain.md`.
