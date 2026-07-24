# ADR 0005: OAuth-Only Authentication for the MCP Endpoint via WorkOS AuthKit

**Date**: 2026-07-04
**Status**: **Superseded by [ADR 0008](./0008-abandon-mcp-integration.md)** — the AuthKit default (non-custom-domain) issuer never served the OAuth/OIDC discovery metadata Claude's clients require; feature abandoned 2026-07-24. Original: Accepted
**Deciders**: Ray Pabonnie, Claude Code
**Related Research**: [`docs/research/0005-mcp-oauth-and-scheduled-agent-research.md`](../research/0005-mcp-oauth-and-scheduled-agent-research.md)
**Related ADRs**: [ADR 0003 (API-key auth)](./0003-security-hashing-and-authentication.md), [ADR 0004 (MCP alongside REST)](./0004-mcp-server-alongside-rest-api.md)

---

## Context and Problem Statement

ADR 0004 adds a `/mcp` endpoint for AI agents alongside the iOS Shortcuts REST endpoint. Its original auth sketch passed the API key as a *tool input parameter* — flawed, because the key would sit in every agent conversation context. Authentication must move to the transport level. The question: what transport-level auth scheme, given that claude.ai web/mobile custom connectors cannot send custom HTTP headers (OAuth 2.1 or unauthenticated only), while Claude Code and cloud Routines support both static bearer headers and OAuth?

**Constraints**: $0 recurring cost; minimal maintenance; the user wants ALL agent surfaces (claude.ai/mobile chat, Claude Code, Routines) to work; the user does **not** want to manage any more API keys; iOS Shortcuts must keep working.

---

## Considered Options

### Option 1: Static bearer API key on `/mcp`
Reuse the existing `gl_` key as `Authorization: Bearer` (~10 lines). Works for Claude Code and Routines, **excludes claude.ai web/mobile** (no custom headers there) and perpetuates agent key management. ❌ Rejected.

### Option 2: Dual auth (OAuth + bearer key)
Accept either an AuthKit JWT or the `gl_` key. Covers everything, but maintains two code paths and keeps agent API-key handling alive for no benefit once OAuth exists. ❌ Rejected.

### Option 3: Azure Entra ID (free tier)
No Dynamic Client Registration ("not in our roadmap" — Microsoft); MCP clients like Claude require DCR or CIMD. Workarounds need an OAuth proxy shim (hundreds of lines to maintain) or paid API Management. ❌ Rejected.

### Option 4: Unauthenticated `/mcp` behind an obscure URL
Supported by Claude connectors, but the endpoint controls tracking of a physical device on a guessable `*.azurewebsites.net` host. ❌ Rejected.

### Option 5: OAuth-only via WorkOS AuthKit ✅ Selected
AuthKit is a spec-compatible OAuth 2.1 authorization server, free to 1M MAU permanently, supporting both CIMD and DCR, with a dedicated MCP guide. Single auth code path; zero agent API keys.

---

## Decision

**`POST /mcp` accepts only WorkOS AuthKit-issued OAuth 2.1 access tokens.** There is no API-key path on `/mcp`.

**The `gl_` API key + `x-api-key` header remains exclusively on `POST /api/generator/toggle` for iOS Shortcuts**, which cannot perform OAuth flows. REST endpoint auth (ADR 0003) is unchanged.

### Server-side responsibilities (implementation in a later session)

1. Serve RFC 9728 metadata at `/.well-known/oauth-protected-resource` pointing to the AuthKit issuer.
2. `onRequest` hook on `/mcp`: verify the bearer JWT against AuthKit's JWKS (cached), checking `iss`/`aud`/`exp`; respond `401` with a `WWW-Authenticate` header referencing the resource metadata on failure — this 401 is what triggers Claude clients to start the OAuth flow.
3. Rate-limit `/mcp` using the token subject as client ID (reuse the existing `RateLimiter`).
4. JWT verification: evaluate `jose` (small, audited, de-facto standard — acceptable per CLAUDE.md security-library exception) vs `node:crypto` hand-rolled JWKS handling. Estimated ~60–100 lines either way.

### Configuration

| Setting | Example | Secret? |
|---------|---------|:-------:|
| `AUTHKIT_ISSUER` | `https://<tenant>.authkit.app` | No — plain app setting |
| `MCP_RESOURCE_URL` | `https://generatorlog-api.azurewebsites.net/mcp` | No — plain app setting |

No new Key Vault secrets. WorkOS dashboard setup (enable CIMD/DCR, register the resource indicator) is documented in [`docs/deployment/cloud-deployment.md`](../deployment/cloud-deployment.md).

---

## Consequences

### Positive
- One auth code path on `/mcp`; no agent API keys to create, distribute, rotate, or leak
- Every Claude surface works: claude.ai web/mobile connectors, Claude Code, cloud Routines — each authenticates once interactively, then reuses/refreshes tokens
- $0: AuthKit free tier at single-user scale is a rounding error
- Tokens are short-lived JWTs; a leaked token expires, unlike a static key

### Negative
- New external dependency on WorkOS — a deliberate trust decision in an established auth vendor (contrast: ntfy.sh was rejected as unvetted, see ADR 0007); if WorkOS ever becomes unacceptable, the documented fallback is the bearer-key design (research 0005 §A.5), restorable without touching the REST path
- ~60–100 lines of JWKS/JWT validation code (possibly one small dependency, `jose`)
- Headless Routines rely on automatic refresh-token renewal; a failed/expired refresh requires one interactive re-authentication on any Claude surface

### Neutral
- The service now has exactly two auth schemes, each with a single owner: `x-api-key` = iOS Shortcuts (REST), OAuth = agents (MCP)

---

## References

- [Research 0005 — Goal A](../research/0005-mcp-oauth-and-scheduled-agent-research.md)
- [MCP Authorization spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [WorkOS AuthKit MCP guide](https://workos.com/docs/authkit/mcp)
- [Claude connector authentication](https://claude.com/docs/connectors/building/authentication)
