# Fase 1 — Privacy/Security components (legal AI / deny-by-default Privacy Gateway)

**Scope:** technical controls that *help* an LGPD-aware design. **Not** a compliance claim. Detection is probabilistic; Presidio itself warns that extra systems are required ([Presidio README](https://github.com/data-privacy-stack/presidio)).

**Repo note:** `microsoft/presidio` now lives at [`data-privacy-stack/presidio`](https://github.com/data-privacy-stack/presidio) (MIT). Docs still often use the old URL.

---

## 1. PII detection

| Projeto | GitHub | Licença | Função | Self-hosted? | Fully local? | Third-party data? | Ponto forte | Risco | Usaria? |
|---|---|---|---|---|---|---|---|---|---|
| **Presidio** | [data-privacy-stack/presidio](https://github.com/data-privacy-stack/presidio) · [supported entities](https://github.com/microsoft/presidio/blob/main/docs/supported_entities.md) | MIT | Analyzer + anonymizer (regex, checksum, spaCy/transformers, optional LLM/Ollama) | Yes (Py / Docker / K8s) | Yes if spaCy/GLiNER local; **no** if Azure OpenAI / cloud LLM recognizer | Only if you enable cloud NLP | Production framework, pluggable, country filter (`countries=["br"]`) | **No built-in CPF/CNPJ** in predefined entities; BR example is a *custom* `BrCpfRecognizer` ([filtering_by_country](https://github.com/data-privacy-stack/presidio/blob/main/docs/analyzer/filtering_by_country.md)); NER weak on PT legal text | **SIM** — framework + custom BR recognizers |
| **Alcatraz** | [hoophq/alcatraz](https://github.com/hoophq/alcatraz) | MIT | In-process Go PII: 51 types / 12 countries; **BR_CPF, BR_CNPJ, BR_RG, BR_CNH, BR_PIS** with mod-11 | Yes (library, no service) | Core: yes (regex+checksum). NER/ONNX optional, air-gap docs | No (unless you add LLM validator — TODO.md flags that as opt-in) | **Best OSS BR ID checksums today**; no HTTP hop | Young (2026), ~34★; pattern-only misses names/addresses unless NER on | **SIM** for BR IDs (Go gateway) or as reference for Presidio validators |
| **python-stdnum** | [arthurdejong/python-stdnum](https://github.com/arthurdejong/python-stdnum) · [stdnum.br.cpf](https://arthurdejong.org/python-stdnum/doc/1.20/stdnum.br.cpf) · [PyPI](https://pypi.org/project/python-stdnum/) | **LGPL-2.1+** | Validate/format CPF + CNPJ (check digits). Not a NER | Yes | Yes (pure Python) | No | Canonical checksums for custom Presidio recognizers | LGPL copyleft on the lib; **not a detector** (no span finding) | **SIM** — validator inside Presidio/Alcatraz-style rules |
| **NVIDIA GLiNER-PII** | [nvidia/gliner-pii](https://huggingface.co/nvidia/gliner-pii) · base [urchade/gliner_large-v2.1](https://huggingface.co/urchade/gliner_large-v2.1) | **NVIDIA Open Model License** (not Apache) | Zero-shot span PII/PHI, 55+ labels | Yes | Yes after model download (CPU/GPU) | First download from HF; runtime local | Zero-shot extra types (OAB, processo) without retrain; NeMo documents this backend | Model license + US/synthetic-heavy training; F1 0.64–0.87 on public benches; **not BR-ID specific** | **TALVEZ** — local NER *after* legal review of NVIDIA license |
| **AEGIS** | [Zokastech/AEGIS](https://github.com/Zokastech/AEGIS) | Apache-2.0 OR MIT | EU-first Presidio alternative (Rust + regex/NER + dashboard) | Yes | Intended local | No (unless you add cloud NER) | Fail-closed HTTP gateway + audit UI | New; EU/GDPR-first, not BR; unproven vs Presidio | **TALVEZ** — watch, not core |
| **Piiranha v1** | [iiiorg/piiranha-v1-detect-personal-information](https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information) · lib [aaronaco/piiranha-redactor-lib](https://github.com/aaronaco/piiranha-redactor-lib) | Check model card (mDeBERTa + ai4privacy) | Multilingual token-class PII (17 types / 6 langs) | Yes | Yes after HF download | HF download only | Strong recall claims on ai4privacy | Small type set; **no CPF/CNPJ**; wrapper maturity | **TALVEZ** — eval only |
| **Phileas / Philterd BR policy** | [philterd/pii-redaction-policies](https://github.com/philterd/pii-redaction-policies/blob/main/policies/philterd/general/brazilian-identifiers.md) | Policy docs (engine is Phileas) | CPF/CNPJ regex + mod-11 | If you run Phileas | Yes | No | Ready-made BR identifier policy | Tied to Phileas stack | **TALVEZ** — copy the *rules*, not the product |

### Presidio vs alternatives (this use case)

| | Presidio | Alcatraz | GLiNER-PII | AEGIS |
|---|---|---|---|---|
| Role | **Orchestrator** | **BR structured IDs** | **Free-text NER** | Young EU gateway |
| CPF/CNPJ | Custom only | Built-in + mod-11 | Unreliable / not targeted | Unlikely first-class |
| Names/addresses in PT | Weak default spaCy | Optional NER | Better candidate | Unknown |
| Legal-doc fit | Best as *pipe* | Best as *checksum layer* | Add-on, license watch | Not yet |

**Recommended PII pipe:** Presidio (or equivalent `/analyze` contract) + `stdnum.br.cpf`/`cnpj` (or Alcatraz) for IDs + **local** GLiNER *if* license OK. Never send case text to a cloud PII API. Add custom entities: OAB, CNJ processo, PJe IDs — none of the above ship those.

---

## 2. DLP / prompt firewalls / LLM DLP

| Projeto | GitHub | Licença | Função | Self-hosted? | Fully local? | Third-party data? | Ponto forte | Risco | Usaria? |
|---|---|---|---|---|---|---|---|---|---|
| **Portcullis** | [pvfOliveira/portcullis](https://github.com/pvfOliveira/portcullis) | Apache-2.0 | Single egress choke-point: chat, streams, **tool args**, **embeddings**; append-only audit; `EgressBlocked` if decision=`block` | Yes (embed) | Yes (you plug detectors) | Only if *your* detector calls out | Matches deny-by-default: **tool/embed channels don’t bypass** | Young; not a full proxy; non-JSON tool leaves **ungated** | **SIM** — library shape for the gateway |
| **AegisGate** | [ax128/AegisGate](https://github.com/ax128/AegisGate) | **MIT** (LICENSE file; site also markets Apache open-core) | Drop-in LLM proxy: PII, injection, output sanitization, audit | Yes | Regex local; optional semantic module via extra URL | If semantic URL is third-party | OpenAI-compatible proxy | New; semantic layer can leak prompts; marketing vs LICENSE mismatch | **TALVEZ** — prototype only |
| **Gitleaks** | [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | MIT | Secret/token DLP (keys, JWTs, AWS…) | Yes | Yes | No | Mature; run on prompt+tool+response | Not PII; false positives | **SIM** — secrets layer |
| **Grob** | [azerozero/grob](https://github.com/azerozero/grob) | Check repo | Rust LLM proxy + DLP + policy | Yes | Intended | Depends on upstream LLM | Tiny/fast DLP-in-proxy | Small community | **TALVEZ** |
| **LiteLLM** | [BerriAI/litellm](https://github.com/BerriAI/litellm) · [Vault integration](https://docs.litellm.ai/docs/secret_managers/hashicorp_vault) | MIT (verify) | Multi-provider proxy, virtual keys, Vault | Yes | Proxy local; **upstream is the LLM** | **Yes** if cloud models | Ops convenience | **Not a security gateway**; easy to fail-open | **TALVEZ** — behind *your* gateway, never instead of it |
| **GuardLayer / similar** | various | varies | “LLM security gateway” clones | Often | Often | Check | Dashboard | Unproven, tiny | **NÃO** |

SaaS DLP (Lakera, Nightfall, etc.): **NÃO** for case text — third-party processing.

---

## 3. Prompt injection

| Projeto | GitHub | Licença | Função | Self-hosted? | Fully local? | Third-party data? | Ponto forte | Risco | Usaria? |
|---|---|---|---|---|---|---|---|---|---|
| **NeMo Guardrails** | [NVIDIA-NeMo/Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) · [docs](https://docs.nvidia.com/nemo/guardrails/about-nemo-guardrails-library/overview) | Apache-2.0 | Input / **retrieval** / dialog / execution / output rails; Colang; Presidio + GLiNER-PII integrations | Yes (SDK or `nemoguardrails server`) | Yes if all models local; **no** if self-check LLM or NVIDIA NIMs / ActiveFence / Private AI | Optional third-party catalog | **Retrieval rails** sit on RAG chunks; tool/execution rails | Colang cost; easy to accidentally call cloud safety APIs; jailbreak detection is not 100% | **SIM** — retrieval + tool rails, **local-only** config |
| **Guardrails AI** | [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) | Apache-2.0 | Input/output **validators** (schema, PII hub) | Yes | Hub validators often pull extra pkgs; hosted inferencing **ending** (cutoff announced Aug 6, 2026, [issue 1560](https://github.com/guardrails-ai/guardrails/issues/1560)) | Hub / old remote inferencing | Structured output | **Not a security firewall**; DetectPromptInjection historically tied to Rebuff+Pinecone ([#760](https://github.com/guardrails-ai/guardrails/issues/760)) | **TALVEZ** — output schema only |
| **LLM Guard** | [protectai/llm-guard](https://github.com/protectai/llm-guard) | MIT | Input/output scanners (injection, PII, secrets, toxicity) | Yes | Designed local (HF models) | HF download | Complete scanner set | **ARCHIVED** (repo + HF models unmaintained) | **NÃO** — fork-or-replace only |
| **Rebuff** | [protectai/rebuff](https://github.com/protectai/rebuff) | Apache-2.0 | Heuristics + LLM detector + VectorDB + canary | Yes option existed | Canary/heuristics local; LLM + Pinecone = **not** | **Yes** if API/Pinecone | Classic 4-layer design | **ARCHIVED 2025-05-16**; prototype; canary leaks to the *same* model | **NÃO** |
| **Llama Prompt Guard / Llama Guard** | Meta HF (Prompt Guard 2 / Llama Guard) | Llama / community licenses | Local classifier: injection / safety | Yes | Yes after weights | HF download | Fast local first-stage | License + EN bias; not a gateway | **TALVEZ** — local cheap pre-filter |

Injection is never solved by a library. Treat as **defense in depth**: allowlisted tools, no raw retrieved HTML/JS as instructions, canary *in retrieved context* (not only user prompt), fail-closed on scanner error.

---

## 4. Policy engines (document authz **before** RAG)

| Projeto | GitHub / docs | Licença | Função | Self-hosted? | Fully local? | Third-party data? | Ponto forte | Risco | Usaria? |
|---|---|---|---|---|---|---|---|---|---|
| **OpenFGA** | [openfga/openfga](https://github.com/openfga/openfga) · [RAG Authorization](https://openfga.dev/docs/modeling/agents/rag-authorization) · [ListObjects](https://openfga.dev/docs/getting-started/perform-list-objects) · [Search + perms](https://openfga.dev/docs/interacting/search-with-permissions) | Apache-2.0 | Zanzibar ReBAC: Check / BatchCheck / **ListObjects** | Yes | Yes (own DB) | No | **Official pre-filter:** `ListObjects(user, viewer, document)` → vector metadata filter **before** retrieval | Extra service; tuple sync from DMS; ListObjects cardinality limits | **SIM** — document ACL for RAG |
| **OPA** | [open-policy-agent/opa](https://github.com/open-policy-agent/opa) · [openpolicyagent.org](https://www.openpolicyagent.org) | Apache-2.0 | Stateless Rego: you **push** data each query | Yes (sidecar/lib) | Yes | No | Perfect **default-deny** at gateway/tools/egress; Git-reviewed policy | **No native “list docs user can read” store**; shipping millions of doc ACLs per request does not scale | **SIM** — gateway/tool/egress. **NÃO** as RAG doc index |
| **Casbin** | [casbin/casbin](https://github.com/casbin/casbin) · [GetImplicitResourcesForUser](https://v1.casbin.org/docs/en/rbac-api) · [issue #905](https://github.com/casbin/casbin/issues/905) | Apache-2.0 | In-process ACL/RBAC/ABAC | Yes (embed) | Yes | No | Fast `enforce(sub, obj, act)` | Reverse lookup is DIY / incomplete for deep folder graphs; you become the graph DB | **NÃO** for firm-wide doc graph. **TALVEZ** tiny in-process RBAC |
| **Keycloak AuthZ / UMA** | [keycloak/keycloak](https://github.com/keycloak/keycloak) · [Authorization Services](https://www.keycloak.org/docs/latest/authorization_services/) | Apache-2.0 | IdP + UMA resource server, RPT tickets | Yes | Yes | No | Identity, SSO, coarse roles | UMA tickets **per resource** — wrong shape for “filter 10M embeddings”; heavy | **SIM** as **IdP**. **NÃO** as RAG permission filter |
| **SpiceDB** (alt) | [authzed/spicedb](https://github.com/authzed/spicedb) | Apache-2.0 | Same Zanzibar class as OpenFGA | Yes | Yes | No if self-hosted | Stronger consistency/ops story at scale | More ops; Authzed cloud = third party | **TALVEZ** if you outgrow OpenFGA |

### OPA vs OpenFGA vs Casbin — permission filter **BEFORE** retrieval

OpenFGA’s own split ([policy vs relationship engines](https://openfga.dev/docs/learn/policy-engine)):

| | **OpenFGA** | **OPA** | **Casbin** |
|---|---|---|---|
| Stores relationships? | **Yes** (tuples) | No — you send data | Optional adapter; not a graph DB |
| `list docs user can read` | **`ListObjects` first-class** | You must precompute/index | `GetImplicitResourcesForUser` returns *policies*, not a scalable object set ([#905](https://github.com/casbin/casbin/issues/905)) |
| Folder → document inheritance | Model: `viewer from folder` | Encode in Rego + dump full tree | `g2` hierarchies; reverse query is awkward |
| Best RAG pattern | **Pre-filter:** ListObjects → vector `id IN (...)`. Post-filter: BatchCheck if candidate set small ([official RAG guide](https://openfga.dev/docs/modeling/agents/rag-authorization)) | ABAC on *already-fetched* attrs; or OPA over a **cached allow-list** | `enforce` after retrieve — **too late** unless you list IDs yourself |
| Deny-by-default | Missing tuple = deny | `default allow := false` | No matching policy = deny |
| This legal RAG | **Primary** | Gateway + “can call LLM / which tools” | Skip for corpus ACL |

**Pattern:** Keycloak authenticates → OpenFGA `ListObjects` **before** vector search → only authorized chunks enter the prompt. Never retrieve-then-hope. Fail closed if OpenFGA is down (do **not** search the full corpus).

---

## 5. Audit logging / secrets (AI gateways)

| Projeto | GitHub / docs | Licença | Função | Self-hosted? | Fully local? | Third-party data? | Ponto forte | Risco | Usaria? |
|---|---|---|---|---|---|---|---|---|---|
| **OpenBao** | [openbao/openbao](https://github.com/openbao/openbao) · [Audit devices](https://openbao.org/docs/audit/) | **MPL-2.0** | Secrets (KV, dynamic, leases) + **fail-closed audit**: if no device can log, **requests do not complete** | Yes | Yes | No | OSI OSS Vault-lineage; HMAC’d audit strings; LiteLLM already speaks Vault API | Audit devices start **off**; `log_raw` can dump secrets; need ≥2 devices | **SIM** — LLM API keys, tenant keys, gateway secrets |
| **HashiCorp Vault** | hashicorp/vault · [LiteLLM](https://docs.litellm.ai/docs/secret_managers/hashicorp_vault) | **BUSL-1.1** since 2023 (not OSI OSS) | Same family | Yes | Yes | No | Mature | License/procurement; IBM product | **TALVEZ** if already in-house |
| **Gitleaks** | above | MIT | Scan prompts/outputs for leaked secrets | Yes | Yes | No | Complements OpenBao (detect what Vault should have held) | Not an audit log | **SIM** |
| **Portcullis audit** | above | Apache-2.0 | Append-only: what left / redacted / blocked | Yes | Yes | No | Ties DLP decision to egress | App-level only | **SIM** — gateway event log |
| **Warden** | [stephnangue/warden](https://github.com/stephnangue/warden) | Check repo | Brokers short-lived Vault/OpenBao creds into agent calls; identity-tied audit | Yes | Yes | Upstream of the *tool*, not the LLM | Agents never hold long-lived secrets | Young | **TALVEZ** — agent/tool plane |

**Audit rules for this gateway (not a product):** structured JSON; **never** store raw CPF/case text (HMAC/tokenize like OpenBao); WORM/object-lock; correlation id across authz + DLP + LLM; if audit write fails → **block** the request (copy OpenBao, not LiteLLM’s async-ish logs).

---

## 6. Zero-trust / fail-closed LLM egress

| Projeto | Docs | Licença | Função | Self-hosted? | Fully local? | Third-party data? | Ponto forte | Risco | Usaria? |
|---|---|---|---|---|---|---|---|---|---|
| **Envoy ext_authz** | [ext_authz](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter.html) | Apache-2.0 | Every egress call hits authz; official example `failure_mode_allow: false` → authz down = **deny** (403) | Yes | Yes | No | Industry fail-closed; works for LLM + tools | Later filters clearing route cache can **bypass** authz (documented) | **SIM** — front door |
| **OPA** | above | Apache-2.0 | `default allow = false`; allowlist model hosts, tools, tenants | Yes | Yes | No | Policy-as-code for egress | Mis-loaded data = wrong allow | **SIM** |
| **Portcullis** | above | Apache-2.0 | `block` ⇒ `EgressBlocked`; `llm_send` / tool **never called** | Yes | Yes | No | Closes embed/tool side-channels | Must wrap *every* SDK | **SIM** |
| **OpenBao audit** | above | MPL-2.0 | No audit sink → no secret issuance → no key for egress | Yes | Yes | No | Ties secrets to logging | Misconfig = total outage (desired) | **SIM** |

**Fail-closed checklist (controls, not a vendor):**

1. Default deny. Missing policy / missing OpenFGA tuple / scanner exception → **block**.
2. Envoy `failure_mode_allow: false`. Never `true` on the LLM cluster.
3. **Allowlist** destinations (Azure OpenAI / local vLLM / none). No arbitrary URL from the model.
4. Detector timeout/5xx → 503, not pass-through (PasteGuard called this out when replacing Presidio).
5. Gate **all four** channels: chat, stream, tool args, embeddings.
6. Authz **before** retrieval; retrieval rails on chunks; output DLP before client.
7. No long-lived provider keys in the app — OpenBao lease → gateway only.

---

## Suggested composition (still Fase 1 — no code)

```
Client → Envoy (ext_authz fail-closed)
      → Privacy Gateway
           ├ Keycloak (who)
           ├ OpenFGA ListObjects (which docs)  ← BEFORE vector search
           ├ Presidio + stdnum/Alcatraz (PII)
           ├ Gitleaks (secrets)
           ├ Local injection classifier ± NeMo retrieval/execution rails
           └ Portcullis-style Gate (chat/stream/tool/embed)
      → Allowlisted LLM only
Audit: append-only HMAC events; OpenBao fail-closed
Secrets: OpenBao (not Vault BUSL unless already mandated)
```

**Do not use as dependencies:** Rebuff, LLM Guard (archived).  
**Do not use as the RAG ACL:** Keycloak UMA, Casbin, OPA-alone.  
**Do not claim LGPD compliance** from this stack — it only implements technical measures (minimization, access control, auditability, fail-closed egress).

**Skipped:** SaaS DLP, hosted Guardrails inferencing, NVIDIA NIM safety APIs (third-party case data). Add when a DPO explicitly accepts that processor.
