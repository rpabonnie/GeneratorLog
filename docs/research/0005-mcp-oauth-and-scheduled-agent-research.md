# MCP OAuth Authentication & Scheduled Claude Agent Research

**Date**: 2026-07-04
**Status**: Research Complete — decisions recorded in ADR 0005, ADR 0006, ADR 0007
**Author**: Claude Code
**Depends on**: [`0003-mcp-server-research.md`](./0003-mcp-server-research.md) (MCP transport + library selection), [`0004-mcp-metrics-and-agent-alerts.md`](./0004-mcp-metrics-and-agent-alerts.md) (MCP surface design, notification options)

---

## Executive Summary

This document answers three questions raised while reviewing the prior MCP research:

1. **Goal A**: How should agents authenticate to the `/mcp` endpoint at $0 cost — and is OAuth even necessary?
2. **Goal B**: How can Claude periodically query the generator service via MCP on a schedule?
3. **Goal C**: With an agent layer in place, what happens to the email notification system?

**Decisions (user-confirmed 2026-07-04):**

| Goal | Decision |
|------|----------|
| A — MCP auth | **OAuth-only via WorkOS AuthKit** on `/mcp` for ALL agent surfaces; the `gl_` API key remains only on the iOS Shortcuts REST endpoint ([ADR 0005](../adr/0005-mcp-oauth-only-workos-authkit.md)) |
| B — Scheduling | **Claude Code cloud Routine** (cron-scheduled cloud agent) as the sole scheduled monitor ([ADR 0006](../adr/0006-scheduled-monitoring-claude-routine.md)) |
| C — Notifications | **Keep SMTP, reduce email to maintenance-critical only**; ntfy.sh rejected on trust grounds ([ADR 0007](../adr/0007-reduce-email-to-critical-only.md)) |

---

## Goal A: MCP Endpoint Authentication

### A.1 Which Claude Surfaces Need What

The decisive constraint: **not all Claude surfaces can send custom HTTP headers.**

| Surface | Static bearer key possible? | OAuth 2.1 supported? |
|---------|:--------------------------:|:--------------------:|
| Claude Code (CLI / desktop) | ✅ `--header "Authorization: Bearer ..."`, `${VAR}` expansion in `.mcp.json` | ✅ 401 triggers interactive OAuth flow via `/mcp` command |
| Claude Code cloud Routines | ✅ via repo `.mcp.json` + environment secrets | ✅ reuses stored OAuth tokens; refreshes headlessly |
| claude.ai web / mobile custom connectors | ❌ **no custom-header support** | ✅ OAuth 2.1 with DCR or CIMD (or unauthenticated) |
| iOS Shortcuts ("Get Contents of URL") | ✅ any request header | ❌ cannot perform OAuth flows |

So a bearer-only design excludes the claude.ai web/mobile chat surface, and an OAuth-only design excludes iOS Shortcuts. Since iOS Shortcuts uses the REST endpoint (per [ADR 0004](../adr/0004-mcp-server-alongside-rest-api.md)) and never touches `/mcp`, the two requirements don't conflict: **`/mcp` can be OAuth-only while REST keeps `x-api-key`.**

### A.2 MCP Authorization Spec Requirements (2025-11-25)

For OAuth-protected MCP servers, the spec requires:

- **OAuth 2.1** with PKCE (S256) — implicit grant removed, exact redirect URI matching
- **RFC 9728 Protected Resource Metadata** — the MCP server serves `/.well-known/oauth-protected-resource` pointing clients at its authorization server
- Client registration via **Dynamic Client Registration (RFC 7591)** or **Client ID Metadata Documents (CIMD)** — Claude supports both; CIMD avoids the "new client registered on every connection" growth problem of DCR
- Refresh-token rotation (or sender-constraining) for public clients

The MCP *server's* job is small: serve the metadata document and validate incoming JWTs against the authorization server's JWKS. The heavy lifting (login UI, consent, token issuance, DCR/CIMD endpoints) lives in the authorization server — which is what we are choosing below.

### A.3 Option 1: WorkOS AuthKit ⭐ (Selected)

**Cost**: Free up to 1,000,000 monthly active users, permanently. Paid features (SSO/SCIM connections) are irrelevant here.

- ✅ Spec-compatible OAuth 2.1 authorization server with a dedicated MCP integration guide
- ✅ Supports both CIMD (preferred) and DCR (dashboard toggle, for backward compatibility)
- ✅ Hosted login UI, token issuance, refresh tokens — zero code on our side for any of it
- ✅ Server-side work is only: RFC 9728 metadata endpoint + JWT validation against AuthKit's JWKS (~60–100 lines)
- ✅ Single-user scale (1 MAU) is a rounding error on the free tier
- ⚠️ New external service dependency — a deliberate, vetted trust decision (WorkOS is an established auth vendor; contrast with ntfy.sh, rejected in Goal C)
- ⚠️ JWT validation needs JWKS fetching + RS256 verification: evaluate `jose` (small, audited, the de-facto standard) vs hand-rolling with `node:crypto` at implementation time. `jose` is an acceptable security-library dependency per CLAUDE.md.

### A.4 Option 2: Azure Entra ID

**Cost**: Free tier exists — but unusable for MCP without extra machinery.

- ❌ **No Dynamic Client Registration** — Microsoft has stated DCR "is not in our roadmap for now"
- ❌ Workarounds all add code or cost: a mock-DCR/OAuth-proxy shim in front of Entra (hundreds of lines to write and maintain), or Azure API Management as an AI gateway (paid tier for production use)
- ❌ Violates the zero-maintenance goal
- ✅ Would keep everything inside the existing Azure tenant

**Verdict**: Rejected.

### A.5 Option 3: Static Bearer API Key Only

Reuse the existing `gl_` key as `Authorization: Bearer` on `/mcp` (same SHA-256 lookup as REST).

- ✅ Zero new services; ~10 lines (an `onRequest` hook)
- ✅ Works for Claude Code and Routines
- ❌ Excludes claude.ai web/mobile custom connectors (no custom headers)
- ❌ Perpetuates manual API-key handling for agents — user explicitly does not want to manage more API keys

**Verdict**: Rejected — viable technically, but excludes a wanted surface and keeps key management alive. Documented here as the fallback if WorkOS ever disappears.

### A.6 Option 4: Unauthenticated `/mcp` (Obscure URL)

Claude connectors support unauthenticated servers, so this "works".

- ❌ The endpoint controls (the tracking of) a physical device and exposes usage data; security-by-obscurity on a public `*.azurewebsites.net` URL fails OWASP basics and the project's own security guidelines

**Verdict**: Rejected outright.

### A.7 Option 5 (also-ran): Auth0 by Okta

Free tier (~25,000 MAU), supports DCR, well documented.

- ⚠️ Heavier product surface than needed; free tier has had feature/limit churn historically; no advantage over AuthKit for MCP specifically

**Verdict**: Not selected; listed for completeness (≥4 options rule).

### A.8 Comparison Matrix

| Criterion | AuthKit ⭐ | Entra ID | Bearer key | Unauthenticated | Auth0 |
|-----------|:---------:|:--------:|:----------:|:---------------:|:-----:|
| $0 at this scale | ✅ | ✅* | ✅ | ✅ | ✅ |
| DCR / CIMD (claude.ai compatible) | ✅ | ❌ | n/a | n/a | ✅ |
| Works for Claude Code + Routines | ✅ | ⚠️ shim | ✅ | ✅ | ✅ |
| Works for claude.ai web/mobile | ✅ | ❌ | ❌ | ✅ | ✅ |
| No agent API-key management | ✅ | ✅ | ❌ | ✅ | ✅ |
| Server-side code | ~60–100 lines | shim: 100s of lines | ~10 lines | 0 | ~60–100 lines |
| Acceptable security posture | ✅ | ✅ | ✅ | ❌ | ✅ |

\* Entra free tier itself is $0 but the required proxy/APIM machinery is not maintenance-free (or not free).

### A.9 Decision: OAuth-Only on `/mcp` via WorkOS AuthKit

All agent interactions authenticate with AuthKit-issued OAuth 2.1 tokens. **No bearer-API-key path exists on `/mcp`.** The `gl_` API key + `x-api-key` header survives exclusively on `POST /api/generator/toggle` for iOS Shortcuts.

**Server-side sketch** (implementation detail for a later session):

```
GET /.well-known/oauth-protected-resource        ← RFC 9728 metadata (JSON, static)
  { "resource": "https://generatorlog-api.azurewebsites.net/mcp",
    "authorization_servers": ["https://<tenant>.authkit.app"] }

onRequest hook on /mcp:
  1. Extract Authorization: Bearer <jwt>
  2. Verify signature against AuthKit JWKS (cached), check iss / aud / exp
  3. 401 with WWW-Authenticate: Bearer resource_metadata="..." on failure
     (the 401 is what triggers Claude clients to start the OAuth flow)
```

**Configuration** (values are identifiers, not secrets — plain app settings, not Key Vault):

| Env var | Example | Secret? |
|---------|---------|:-------:|
| `AUTHKIT_ISSUER` | `https://<tenant>.authkit.app` | No |
| `MCP_RESOURCE_URL` | `https://generatorlog-api.azurewebsites.net/mcp` | No |

**WorkOS dashboard setup**: enable CIMD (and DCR for backward compatibility), register the MCP resource indicator URL. Detailed steps belong in `docs/deployment/cloud-deployment.md`.

**Operational note — headless Routines**: cloud Routines reuse stored OAuth tokens and refresh them automatically. Refresh tokens for public clients rotate per OAuth 2.1; if a refresh ever fails (revocation, long expiry), one interactive re-authentication on any Claude surface restores the connection. This is the price of "no API keys" and is acceptable for a personal service.

---

## Goal B: Scheduled Claude Agent ("Claude checks my generator")

### B.1 Option 1: Claude Code Cloud Routine ⭐ (Selected)

Routines (shipped ~April 2026) are named, cron-scheduled invocations of Claude Code running in Anthropic's managed cloud, with access to the tools and MCP servers granted to them. Minimum interval: 1 hour. Runs on the existing Claude subscription — $0 incremental.

- ✅ Exactly the requested experience: Claude reads `generator://health` / calls `get_generator_health` and reports conversationally ("87 of 100 hours used — schedule an oil change within 2–3 runs")
- ✅ Uses the same OAuth connection as interactive sessions — no separate credentials
- ✅ No infrastructure, nothing to deploy
- ⚠️ Routine definition lives in Claude's cloud, not in git → the Routine prompt is documented in ADR 0006 for reproducibility
- ⚠️ Depends on an active Claude subscription
- ⚠️ Azure F1 has no Always-On: the first request after idle hits a cold start (~10–30 s). Agents tolerate this; no action needed.

### B.2 Option 2: GitHub Actions Cron (research 0004's pick)

Deterministic curl → health endpoint → notify. Free, versioned in git.

**Verdict**: Superseded for the scheduled-*agent* role — it is not "Claude as the agent" and its notification leg assumed ntfy.sh, which was rejected (Goal C). Remains a valid future fallback and is kept documented in research 0004.

### B.3 Option 3: Claude Desktop / Local Scheduled Tasks

Local scheduled tasks can run Claude with local tools on a schedule.

**Verdict**: Rejected — requires the user's machine to be on; a generator monitor must not depend on a workstation.

### B.4 Option 4: In-Process Cron + LLM API Call

Backend `setInterval`/cron calls the Anthropic API and emails the result.

**Verdict**: Rejected — adds an API key to manage (contradicts Goal A's "no more API keys"), plus LLM billing setup, for a worse experience than a Routine.

### B.5 Comparison Matrix

| Criterion | Routine ⭐ | GH Actions | Desktop task | In-process |
|-----------|:---------:|:----------:|:------------:|:----------:|
| $0 incremental | ✅ (subscription) | ✅ | ✅ | ⚠️ API billing |
| Conversational Claude assessment | ✅ | ⚠️ optional | ✅ | ⚠️ raw API |
| Runs without user's machine | ✅ | ✅ | ❌ | ✅ |
| No new credentials to manage | ✅ (OAuth) | ❌ (repo secret) | ✅ | ❌ (API key) |
| Config versioned in git | ❌ (mitigated: ADR) | ✅ | ❌ | ✅ |

### B.6 Example Routine (to create at implementation time)

- **Schedule**: weekly, Monday 08:00 local (`0 13 * * 1` UTC)
- **MCP server granted**: `generatorlog` (the `/mcp` endpoint, OAuth)
- **Prompt**:

> Check my generator using the generatorlog MCP server. Read the health resource (or call `get_generator_health`). If maintenance status is `warning` or worse, tell me plainly what to do and how urgent it is, estimating how many typical runs remain before the oil change is due. If everything is healthy, reply with one short sentence confirming it. Note that the server may take up to 30 seconds to respond on the first call (cold start) — retry once if the first attempt times out.

---

## Goal C: Notification Strategy (supersedes research 0004 Goals 2 & 4)

### C.1 Context

Research 0004 recommended ntfy.sh push notifications (Options C/D of its Goal 2). During review the user **rejected ntfy.sh**: it is a third-party service with no established trust basis, and no additional push notifications are wanted. Constraint: if no acceptable alternative exists, SMTP stays.

### C.2 Re-evaluated Options

| Option | Verdict |
|--------|---------|
| Email on every stop (status quo) | ❌ Noisy — the original complaint |
| ntfy.sh push | ❌ Rejected: unvetted third party; no push wanted |
| Remove email entirely, Routine-only | ❌ No Claude-independent fallback for a physical-maintenance alert; SMTP also serves password-reset emails, so the stack can't be deleted anyway |
| **Threshold-exceeded email only; Routine covers routine status** ⭐ | ✅ Bare-minimum email, zero new services, trusted channel kept |

### C.3 Decision

Keep SMTP. Drop the per-stop confirmation email; keep only the maintenance-threshold email. The weekly Routine provides routine status conversationally.

**Later implementation** (one small change, not this round): in `backend/src/services/email.ts`, `sendGeneratorStopEmails()` currently branches to `sendMaintenanceReminderEmail()` or `sendStopConfirmationEmail()`. The stop-confirmation branch goes away — equivalently, the toggle route calls the existing `sendMaintenanceAlertIfNeeded()` instead. Email volume drops from every-stop to a few per year. No config, secret, or dependency changes.

---

## References

- MCP Authorization spec (2025-11-25): https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- OAuth 2.0 Protected Resource Metadata (RFC 9728): https://www.rfc-editor.org/rfc/rfc9728
- WorkOS AuthKit MCP guide: https://workos.com/docs/authkit/mcp
- WorkOS pricing (AuthKit free to 1M MAU): https://workos.com/pricing
- Claude custom connectors (remote MCP): https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Claude connector authentication (DCR/CIMD): https://claude.com/docs/connectors/building/authentication
- Claude Code MCP configuration (headers, OAuth, `.mcp.json`): https://code.claude.com/docs/en/mcp
- Claude Code scheduled tasks & cloud Routines: https://code.claude.com/docs/en/scheduled-tasks
- Entra ID DCR incompatibilities with MCP: https://www.groff.dev/blog/azure-entra-id-mcp-server-authentication-incompatibilities
- Entra ID + pre-authorized clients (Microsoft): https://techcommunity.microsoft.com/blog/azuredevcommunityblog/building-mcp-servers-with-entra-id-and-pre-authorized-clients/4508453
- Prior research: [`0003-mcp-server-research.md`](./0003-mcp-server-research.md), [`0004-mcp-metrics-and-agent-alerts.md`](./0004-mcp-metrics-and-agent-alerts.md)
