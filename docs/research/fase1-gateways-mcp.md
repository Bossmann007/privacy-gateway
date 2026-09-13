# FASE 1 — Gateways, MCP e assistentes (deny-by-default)

Princípio: LLM externo **nunca** vê DB / filesystem / vector store. Só contexto sanitizado via Privacy/AI Gateway. MCP BYOAI = tools com capability scope. **Nunca `execute_sql`.**

Fontes: docs oficiais, LICENSE no GitHub, spec MCP 2025-11-25. Snapshot ~set/2026.

---

## 1. AI / LLM Gateways

**Comparação (não lista):** para escritório jurídico self-host, o eixo real é *proxy OpenAI-compatível que você opera* vs *control-plane comercial*. **LiteLLM** é o default OSS (MIT, virtual keys, fallback, MCP allowlist, 100+ providers). **Bifrost** é o substituto Go se LiteLLM ficar pesado. **Portkey** tem gateway MIT, mas MCP/guardrails/obs gravitam para cloud (agora “PRISMA AIRS”). **Helicone** é observabilidade (Apache) + gateway Rust (GPL-3.0). **Kong** só vale se já roda Kong **e** paga Enterprise (MCP/PII/semantic cache não estão no OSS). **TrueFoundry** self-hosta, **não é OSS**. Cloudflare / Vercel / OpenRouter: managed — prompt sai da rede. **Envoy AI Gateway** entra se o stack já é Envoy/K8s.

### LiteLLM

**Projeto:** LiteLLM (AI Gateway / LLM Proxy)  
**GitHub:** https://github.com/BerriAI/litellm  
**Licença:** MIT no core; pasta `enterprise/` tem license própria ([LICENSE](https://github.com/BerriAI/litellm/blob/main/LICENSE); [Enterprise vs OSS](https://docs.litellm.ai/docs/enterprise))  
**Função:** Proxy OpenAI-compatível: 100+ providers, virtual keys, budgets, fallback, cache, guardrails (Presidio PII no OSS), MCP Gateway com ACL por key/team, OAuth 2.0 MCP.  
**Self-hosted?** Sim (Docker/K8s).  
**Pode funcionar totalmente local?** Sim — aponta para Ollama/vLLM/local OpenAI-compat; sem callback cloud.  
**Dados enviados para terceiros?** Só se você configurar provider externo. Telemetria Scarf **on por default** — `litellm --telemetry False` ([CLI](https://docs.litellm.ai/docs/proxy/cli)). Logs de prompt ficam no seu Postgres se o proxy persistir request/response.  
**Ponto forte:** Superfície OSS mais madura; um endpoint para BYOAI + local; ACL MCP por key/team.  
**Risco (sigilo jurídico):** Proxy **não é** Privacy Gateway. Sem allowlist, MCP vira pass-through de `execute_sql`/filesystem. SSO/RBAC/audit fino = Enterprise. 5k+ issues abertos.  
**Usaria no projeto?** **SIM** — plano LLM only; MCP só com allowlist explícita; telemetria off; nunca DB/vector atrás dele.

### Bifrost (Maxim / H3 Labs)

**Projeto:** Bifrost  
**GitHub:** https://github.com/maximhq/bifrost  
**Licença:** Apache-2.0 ([LICENSE](https://github.com/maximhq/bifrost/blob/dev/LICENSE), © 2025 H3 Labs)  
**Função:** Gateway Go, API OpenAI-compatível, failover, cache semântico, guardrails, endpoint `/mcp` (gateway mode).  
**Self-hosted?** Sim.  
**Pode funcionar totalmente local?** Sim (providers locais).  
**Dados enviados para terceiros?** Só providers que você ligar. Enterprise vende clustering/SSO/export.  
**Ponto forte:** Performance (claim ~11 µs @ 5k RPS); Apache limpo; MCP com virtual keys e `x-bf-mcp-include-tools` ([docs](https://docs.getbifrost.ai/mcp/gateway)).  
**Risco:** Mais novo que LiteLLM; features “enterprise” no marketing; auto-inject de tools deve ficar **off**.  
**Usaria no projeto?** **TALVEZ** — plano B se LiteLLM for gargalo; mesma regra: sem SQL tools.

### Portkey Gateway (PRISMA AIRS)

**Projeto:** Portkey AI Gateway  
**GitHub:** https://github.com/Portkey-AI/gateway  
**Licença:** MIT ([LICENSE](https://github.com/Portkey-AI/gateway/blob/main/LICENSE))  
**Função:** Gateway TS: 1600+ models, cache, fallback, guardrails. OSS: `npx @portkey-ai/gateway`. MCP Gateway (auth, tool provisioning, logs) é produto Portkey/cloud ([MCP Gateway](https://portkey.ai/docs/product/mcp-gateway); [AI Gateway](https://portkey.ai/docs/product/ai-gateway)). Rebrand 2026: “Portkey is now PRISMA AIRS AI Gateway”.  
**Self-hosted?** Gateway sim; control-plane/MCP/obs = hybrid/cloud.  
**Pode funcionar totalmente local?** Só o binary do gateway.  
**Dados enviados para terceiros?** Se “connect to Portkey”: prompts/tools no SaaS.  
**Ponto forte:** Guardrails + MCP provisioning no produto pago.  
**Risco:** Lock-in + prompts no vendor. Ruim para sigilo se não for air-gap.  
**Usaria no projeto?** **NÃO** como control-plane. **TALVEZ** só o binary MIT atrás da sua rede, sem conta Portkey.

### Helicone (dois repos)

**Projeto A — Observability:** Helicone  
**GitHub:** https://github.com/Helicone/helicone  
**Licença:** Apache-2.0  
**Função:** Logs/custo/eval de chamadas LLM.  
**Self-hosted?** Sim ([self-host](https://docs.helicone.ai/getting-started/self-host/overview)).  
**Pode funcionar totalmente local?** Sim (Docker/K8s). Cloud = prompts no Helicone.  
**Dados enviados para terceiros?** Cloud: sim (prompts). Self-host: não, salvo LLM provider.  
**Ponto forte:** Audit trail de o que o gateway mandou ao modelo.  
**Risco:** Cloud = terceiro lê o caso. Self-host ainda guarda prompt completo — tratar logs como processo privilegiado.  
**Usaria no projeto?** **TALVEZ** — sink de auditoria **self-host**, nunca `us.helicone.ai`.

**Projeto B — AI Gateway:** Helicone AI Gateway  
**GitHub:** https://github.com/Helicone/ai-gateway  
**Licença:** GPL-3.0  
**Função:** Gateway Rust, routing, cache, rate-limit.  
**Self-hosted?** Sim.  
**Pode funcionar totalmente local?** Sim.  
**Dados enviados para terceiros?** Cloud gateway sim; self-host não.  
**Ponto forte:** Leve, OpenAI-compat.  
**Risco:** GPL-3.0 contamina derivado proprietário; produto mais novo.  
**Usaria no projeto?** **NÃO** como core (GPL + overlap com LiteLLM).

### Kong AI Gateway

**Projeto:** Kong Gateway + plugins AI  
**GitHub:** https://github.com/Kong/kong  
**Licença:** Apache-2.0 no core; AI avançado (semantic cache/routing, PII, **AI MCP Proxy**) = Enterprise ([comparativo](https://api7.ai/kong-ai-gateway-vs-litellm); [Kong vs LiteLLM](https://konghq.com/blog/enterprise/kong-ai-gateway-vs-litellm))  
**Função:** API gateway + plugins LLM/MCP.  
**Self-hosted?** Sim (ou Konnect SaaS).  
**Pode funcionar totalmente local?** Data plane sim; AI “de verdade” exige license.  
**Dados enviados para terceiros?** Konnect: control-plane Kong. Self-host OSS: não.  
**Ponto forte:** Se já é loja Kong: uma policy plane.  
**Risco:** OSS AI raso; custo Enterprise; complexidade.  
**Usaria no projeto?** **NÃO** — greenfield jurídico não justifica Kong+Enterprise.

### TrueFoundry AI Gateway

**Projeto:** TrueFoundry AI Gateway  
**GitHub:** sem repo do gateway (org: SDKs/charts; Cognita RAG arquivado) — https://github.com/truefoundry  
**Licença:** proprietária (skills MIT ≠ gateway)  
**Função:** Gateway enterprise: 1000+ LLMs, MCP, guardrails; SaaS / hybrid / VPC ([intro](https://www.truefoundry.com/docs/ai-gateway/intro-to-llm-gateway); [self-host](https://www.truefoundry.com/docs/ai-gateway/gateway-self-hosted)).  
**Self-hosted?** Sim (pago).  
**Pode funcionar totalmente local?** On-prem sim, com vendor.  
**Dados enviados para terceiros?** SaaS/hybrid: sim. Full self-host: depende do contrato.  
**Ponto forte:** Pacote ops.  
**Risco:** Não OSS; vendor lock; não audita código do proxy.  
**Usaria no projeto?** **NÃO** — viola preferência OSS + auditoria de sigilo.

### Envoy AI Gateway

**Projeto:** Envoy AI Gateway  
**GitHub:** https://github.com/envoyproxy/ai-gateway  
**Licença:** Apache-2.0  
**Função:** Envoy Gateway para GenAI + MCP: OAuth, `toolSelector`, JWT/CEL, API-key injection ([MCP docs](https://aigateway.envoyproxy.io/docs/next/capabilities/mcp/)).  
**Self-hosted?** Sim (K8s).  
**Pode funcionar totalmente local?** Sim.  
**Dados enviados para terceiros?** Não (só providers).  
**Ponto forte:** Policy de tool no data plane; padrão Envoy.  
**Risco:** Ops K8s pesado. CVE MCP smuggling [GHSA-4gph-2hhr-5mwg](https://github.com/envoyproxy/ai-gateway/security/advisories/GHSA-4gph-2hhr-5mwg) — parser JSON case-insensitive. Sem `toolSelector`, **todas** as tools vazam.  
**Usaria no projeto?** **TALVEZ** — se já há Envoy; senão agentgateway é mais focado em MCP.

**Fora:** Cloudflare AI Gateway, Vercel AI Gateway, OpenRouter — managed; prompts no vendor. **NÃO.**

---

## 2. MCP Gateways / proxies / security

**Comparação:** spec oficial (2025-11-25) = MCP HTTP é **OAuth 2.1 resource server**: RFC 9728, RFC 8414, PKCE, **RFC 8707 resource indicators**, audience check ([Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization); [Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)). Ameaças: confused deputy, token pass-through, tool poisoning.

Produtos: **agentgateway** (LF) = melhor policy por tool (CEL, deny implícito, filtra `tools/list`). **Docker MCP Gateway** = isolamento de processo (container), não Privacy Gateway. **ContextForge** = registry/federação pesada. **Envoy AI Gateway** = mesmo nicho, mais Envoy. **LiteLLM/Portkey/Bifrost MCP** = conveniência, allowlist obrigatória. **db-mcp-gateway** = SQL para o agente — **proibido** no desenho. Padrão Red Hat/Kuadrant: RFC 8693 token exchange, nunca PAT largo no upstream ([artigo](https://developers.redhat.com/articles/2025/12/12/advanced-authentication-authorization-mcp-gateway)).

### Spec MCP (padrão, não produto)

**Projeto:** Model Context Protocol — Authorization + Security Best Practices  
**GitHub:** https://github.com/modelcontextprotocol/modelcontextprotocol  
**Licença:** spec (não é runtime)  
**Função:** OAuth 2.1, metadata, scopes least-privilege, anti-confused-deputy.  
**Self-hosted?** N/A — implementar no gateway.  
**Pode funcionar totalmente local?** Sim (Keycloak/Authentik).  
**Dados enviados para terceiros?** Não.  
**Ponto forte:** Única fonte normativa 2025–2026.  
**Risco:** Implementar errado (pass-through de token, DCR + static client_id).  
**Usaria no projeto?** **SIM** — contrato de auth do Privacy/MCP Gateway.

### agentgateway (Solo.io → Linux Foundation)

**Projeto:** agentgateway  
**GitHub:** https://github.com/agentgateway/agentgateway  
**Licença:** Apache-2.0  
**Função:** Proxy Rust para HTTP/LLM/MCP/A2A. `mcpAuthorization` em CEL: `mcp.tool.name`, `mcp.tool.target`, JWT; tool negada some do `tools/list` ([docs](https://agentgateway.dev/docs/standalone/main/mcp/mcp-authz)).  
**Self-hosted?** Sim (binary/Docker/K8s).  
**Pode funcionar totalmente local?** Sim.  
**Dados enviados para terceiros?** Não.  
**Ponto forte:** Deny-by-default **por tool** — encaixa no princípio.  
**Risco:** Distro Enterprise Solo vs OSS; ainda jovem. AuthZ em nome da tool, **não** em argumentos (`mcp.tool.arguments` só em access log).  
**Usaria no projeto?** **SIM** — plano MCP/policy. Allowlist: `search_sanitized_memory`, nunca `execute_sql`.

### Docker MCP Gateway

**Projeto:** Docker MCP Gateway (`docker-mcp`)  
**GitHub:** https://github.com/docker/mcp-gateway  
**Licença:** MIT  
**Função:** Sobe MCP servers em containers isolados; um endpoint; profiles; secrets Docker; OAuth. Docs: [MCP Gateway](https://docs.docker.com/ai/mcp-catalog-and-toolkit/mcp-gateway/). “AI Governance” Desktop = invite-only.  
**Self-hosted?** Sim (`docker mcp` sem Desktop).  
**Pode funcionar totalmente local?** Sim, catalog local. Catalog Hub puxa imagens Docker.  
**Dados enviados para terceiros?** Catalog/Hub se usar MCP Catalog público.  
**Ponto forte:** Sandbox de processo — MCP malicioso não senta no host.  
**Risco:** Isolamento ≠ authorization. Catalog público = supply-chain. Sem CEL por tool.  
**Usaria no projeto?** **TALVEZ** — runtime isolado **atrás** do agentgateway; catalog só interno.

### IBM ContextForge

**Projeto:** ContextForge AI Gateway  
**GitHub:** https://github.com/IBM/mcp-context-forge  
**Licença:** Apache-2.0  
**Função:** Registry/proxy MCP + A2A + REST/gRPC; virtual servers; plugins; OTel ([site](https://ibm.github.io/mcp-context-forge/)).  
**Self-hosted?** Sim (PyPI/Docker/K8s).  
**Pode funcionar totalmente local?** Sim.  
**Dados enviados para terceiros?** Não.  
**Ponto forte:** Federação e virtualização de API → MCP.  
**Risco:** Superfície enorme (839 issues); default “federate everything” quebra least-privilege.  
**Usaria no projeto?** **TALVEZ** — registry interno depois; não MVP.

### LiteLLM MCP Gateway

**Projeto:** LiteLLM MCP (mesmo repo)  
**GitHub:** https://github.com/BerriAI/litellm  
**Licença:** MIT (+ enterprise)  
**Função:** Um `/mcp` para N servers; ACL key/team; OAuth/PKCE; stdio/SSE/HTTP; OpenAPI→MCP ([docs](https://docs.litellm.ai/docs/mcp)).  
**Self-hosted?** Sim.  
**Pode funcionar totalmente local?** Sim.  
**Dados enviados para terceiros?** Só se MCP/LLM for remoto.  
**Ponto forte:** Um componente com o LLM gateway.  
**Risco:** Sem deny default: registra GitHub/Zapier/DB e o modelo chama. `extra_headers` pode vazar credencial.  
**Usaria no projeto?** **TALVEZ** — só se cada server for allowlist sanitizada; **nunca** MCP SQL.

### Portkey MCP Gateway

**Projeto:** Portkey MCP Gateway  
**GitHub:** parte de Portkey (não um runtime OSS separado)  
**Licença:** produto (gateway core MIT ≠ este plano)  
**Função:** Auth, tool enable/disable por user, logs de args/response, rate limit ([docs](https://portkey.ai/docs/product/mcp-gateway)). Endpoint `https://mcp.portkey.ai/...`.  
**Self-hosted?** Não como default.  
**Pode funcionar totalmente local?** Não.  
**Dados enviados para terceiros?** Sim — tool args + results no Portkey.  
**Ponto forte:** UX de registry.  
**Risco:** Terceiro vê conteúdo jurídico.  
**Usaria no projeto?** **NÃO.**

### db-mcp-gateway

**Projeto:** db-mcp-gateway  
**GitHub:** https://github.com/developerz-ai/db-mcp-gateway  
**Licença:** (verificar no repo; produto novo)  
**Função:** MCP com SSO + YAML grants + SQL (read-only default, `query_write` opt-in).  
**Self-hosted?** Sim.  
**Pode funcionar totalmente local?** Sim.  
**Dados enviados para terceiros?** Não.  
**Ponto forte:** Credencial não sai do gateway.  
**Risco:** **É `execute_sql`.** LLM externo recebe rows. Viola o princípio mesmo com read-only.  
**Usaria no projeto?** **NÃO** — nem como BYOAI tool.

---

## 3. Assistentes self-hosted (arquitetura de referência)

**Comparação:** os três são **chat+RAG+tools**. O modelo recebe chunks do vector store e pode chamar web/SQL/MCP/filesystem. Isso é o **oposto** de deny-by-default. Servem de UX (workspace, RBAC, upload), **não** de plataforma. Nenhum substitui Privacy/AI Gateway.

| | Open WebUI | AnythingLLM | Dify |
|---|---|---|---|
| Foco | Chat multi-modelo + tools | Workspace RAG + agents | Workflow/app builder |
| LLM vê docs RAG? | Sim | Sim | Sim |
| SQL/DB tool? | Via tools/MCP | **SQL Agent nativo** | Plugin Text-to-SQL + SQL Execute |
| MCP | Sim (tools ao modelo) | Sim (qualquer server) | HTTP MCP in/out |
| Licença | Open WebUI License (branding >50 users) | MIT | Apache modificado |

### Open WebUI

**Projeto:** Open WebUI  
**GitHub:** https://github.com/open-webui/open-webui  
**Licença:** Open WebUI License (BSD-3 + cláusula de branding; >50 users/30d sem remover marca, ou enterprise) — [LICENSE](https://github.com/open-webui/open-webui/blob/main/LICENSE)  
**Função:** UI ChatGPT-like; Ollama/OpenAI; RAG; tools/MCP/OpenAPI; RBAC.  
**Self-hosted?** Sim.  
**Pode funcionar totalmente local?** Sim (Ollama + vector local).  
**Dados enviados para terceiros?** Opcional. `ENABLE_COMMUNITY_SHARING` default **true** (link de chat entre users). `ENABLE_DIRECT_CONNECTIONS` default false — manter assim. Hardening: https://docs.openwebui.com/getting-started/advanced-topics/hardening/  
**Ponto forte:** UX e SSO/OIDC.  
**Risco:** Tools Access ≈ root do host. RAG manda trechos ao LLM. Licença não-OSI pura. Community sharing.  
**Usaria no projeto?** **NÃO** como plataforma. **TALVEZ** como referência de UI, atrás do gateway, tools/MCP **off**.

### AnythingLLM

**Projeto:** AnythingLLM  
**GitHub:** https://github.com/Mintplex-Labs/anything-llm  
**Licença:** MIT  
**Função:** RAG por workspace; agents; **SQL Agent** (`list-tables`, `check-table-schema`, `query`); MCP qualquer transport ([SQL Agent](https://docs.anythingllm.com/agent/usage/sql-agent); [MCP](https://docs.anythingllm.com/mcp-compatibility/overview)).  
**Self-hosted?** Sim (Desktop/Docker). Air-gap documentado se 100% local.  
**Pode funcionar totalmente local?** Sim (Ollama + LanceDB).  
**Dados enviados para terceiros?** Telemetria PostHog **on**; opt-out `DISABLE_TELEMETRY=true` ou Privacy. Eventos sem conteúdo de chat; ainda assim outbound. CDN `cdn.anythingllm.com` + GitHub raw mesmo com telemetry off ([README](https://github.com/Mintplex-Labs/anything-llm)).  
**Ponto forte:** MIT; isolamento por workspace; local-first.  
**Risco:** SQL Agent **é** execute_sql (docs: “does not prevent it from running other SQL”). MCP sem capability-scope. Embedder/vector são instance-level.  
**Usaria no projeto?** **NÃO** — viola deny-by-default de fábrica.

### Dify

**Projeto:** Dify  
**GitHub:** https://github.com/langgenius/dify  
**Licença:** Apache-2.0 **modificado** — proíbe multi-tenant SaaS sem autorização; não remover logo do frontend; produtor pode endurecer a license ([LICENSE](https://github.com/langgenius/dify/blob/main/LICENSE)). **Não é OSI Apache puro.**  
**Função:** Builder de apps/workflows/agents; RAG; marketplace; MCP HTTP; tools DB (Text-to-SQL, SQL Execute, schema). Self-host: Docker Compose ([quick start](https://docs.dify.ai/en/self-host/quick-start)).  
**Self-hosted?** Sim.  
**Pode funcionar totalmente local?** Parcial — stack local (Weaviate/Postgres), mas plugins/marketplace e LLMs cloud são o caminho feliz.  
**Dados enviados para terceiros?** Cloud Dify: sim. Self-host + LLM local: não, salvo plugin.  
**Ponto forte:** Orquestração visual; sandbox SSRF no compose.  
**Risco:** Agent node escolhe tools (SQL/files/MCP). License instável. Multi-workspace = “tenant” na license.  
**Usaria no projeto?** **NÃO** — arquitetura agent-com-SQL + license.

---

## Recomendação para o desenho (FASE 1)

```
[UI própria]
    → Privacy Gateway (você escreve: sanitize, redact, quota de contexto)
        → LiteLLM (BYOAI / Ollama)     [LLM plane]
    → agentgateway                      [MCP plane, CEL deny-by-default]
        → Docker MCP (opcional)         [sandbox de processo]
            → só tools: search_memory, get_doc_excerpt, …
            → NUNCA execute_sql / read_file / query_raw
```

| Camada | Pegar | Evitar |
|---|---|---|
| LLM proxy | LiteLLM OSS | TrueFoundry, Portkey cloud, Kong sem Enterprise |
| MCP policy | agentgateway + spec OAuth | db-mcp-gateway, MCP Catalog público, pass-through token |
| UI/RAG | código próprio ou Open WebUI **sem tools** | AnythingLLM/Dify como cérebro |
| Logs | Helicone **self-host** ou OTel seu | Helicone/Portkey/Langfuse cloud com prompt |

**Não existe** gateway OSS que seja sozinho o Privacy/AI Gateway jurídico. LiteLLM + agentgateway cobrem *transporte e permissão de tool*. Sanitização de contexto, PII, privilege de documento e “LLM nunca vê SQL cru” continuam código de vocês.

---

## Citações

- LiteLLM LICENSE / Enterprise / MCP / telemetry: https://github.com/BerriAI/litellm · https://docs.litellm.ai/docs/enterprise · https://docs.litellm.ai/docs/mcp · https://docs.litellm.ai/docs/proxy/cli  
- Portkey: https://github.com/Portkey-AI/gateway · https://portkey.ai/docs/product/ai-gateway · https://portkey.ai/docs/product/mcp-gateway  
- Bifrost: https://github.com/maximhq/bifrost · https://docs.getbifrost.ai/mcp/gateway  
- Helicone: https://github.com/Helicone/helicone (Apache-2.0) · https://github.com/Helicone/ai-gateway (GPL-3.0) · https://docs.helicone.ai/getting-started/self-host/overview  
- Kong: https://github.com/Kong/kong · https://konghq.com/blog/enterprise/kong-ai-gateway-vs-litellm  
- TrueFoundry: https://www.truefoundry.com/docs/ai-gateway/intro-to-llm-gateway  
- Envoy AI Gateway: https://github.com/envoyproxy/ai-gateway · https://aigateway.envoyproxy.io/docs/next/capabilities/mcp/ · https://github.com/envoyproxy/ai-gateway/security/advisories/GHSA-4gph-2hhr-5mwg  
- MCP spec: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization · https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices  
- agentgateway: https://github.com/agentgateway/agentgateway · https://agentgateway.dev/docs/standalone/main/mcp/mcp-authz  
- Docker MCP: https://github.com/docker/mcp-gateway · https://docs.docker.com/ai/mcp-catalog-and-toolkit/mcp-gateway/  
- ContextForge: https://github.com/IBM/mcp-context-forge · https://ibm.github.io/mcp-context-forge/  
- Open WebUI LICENSE + hardening: https://github.com/open-webui/open-webui/blob/main/LICENSE · https://docs.openwebui.com/getting-started/advanced-topics/hardening/  
- AnythingLLM LICENSE + SQL + telemetry: https://github.com/Mintplex-Labs/anything-llm · https://docs.anythingllm.com/agent/usage/sql-agent  
- Dify LICENSE + self-host + tools: https://github.com/langgenius/dify/blob/main/LICENSE · https://docs.dify.ai/en/self-host/quick-start · https://docs.dify.ai/en/cloud/use-dify/workspace/tools
