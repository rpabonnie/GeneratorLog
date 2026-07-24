# ADR 0008: Abandon the MCP Server Integration (WorkOS AuthKit OAuth Blocker)

**Date**: 2026-07-24
**Status**: Accepted
**Deciders**: Ray Pabonnie, Claude Code
**Supersedes**: [ADR 0004 (MCP alongside REST)](./0004-mcp-server-alongside-rest-api.md), [ADR 0005 (MCP OAuth-only via AuthKit)](./0005-mcp-oauth-only-workos-authkit.md), [ADR 0006 (Scheduled monitoring via Routine)](./0006-scheduled-monitoring-claude-routine.md), [ADR 0007 (Reduce email to critical-only)](./0007-reduce-email-to-critical-only.md)

---

## Context and Problem Statement

ADRs 0004–0007 planned an MCP (Model Context Protocol) server exposed at `POST /mcp`, so Claude
surfaces (the Claude iPhone app, claude.ai web connectors, Claude Code, and cloud Routines) could
issue generator start/stop commands and read status conversationally. Authentication was OAuth-only
via **WorkOS AuthKit** (ADR 0005), chosen specifically so the claude.ai web/mobile connectors —
which cannot send custom HTTP headers — would work, while avoiding any new agent API keys.

The implementation was completed on branch `feat/mcp-server-implementation`
(`backend/src/mcp/{auth,routes,tools}.ts`): stateless Streamable-HTTP MCP, RFC 9728
protected-resource metadata, AuthKit JWT verification via OIDC-discovered JWKS, rate limiting by
token subject, and enrollment/invite gating. The backend side worked correctly — it was
**deployed to Azure and verified** returning the proper `401` challenge and RFC 9728 metadata.

The blocker was entirely on the **OAuth handshake between Claude and WorkOS AuthKit**, and it could
not be resolved without infrastructure the project owner declined to acquire.

## What actually broke

The user's AuthKit environment uses the **default issuer form** (no custom domain):
`https://api.workos.com/user_management/client_01KWQ19TNX0X0KFMK0083Q68F6`. This issuer's only
discovery document is `/.well-known/openid-configuration`, and it is **minimal** — it returns
`issuer`, `authorization_endpoint`, `token_endpoint`, `response_types_supported`, and `jwks_uri`,
and nothing else. Critically it omits fields that OAuth/OIDC clients rely on:

- `subject_types_supported` and `id_token_signing_alg_values_supported` — **required** by OIDC
  Discovery 1.0 §3.
- `registration_endpoint` (DCR), `client_id_metadata_document_supported` + `none` in
  `token_endpoint_auth_methods_supported` (CIMD), and `code_challenge_methods_supported` (PKCE
  advertisement) — the flags Claude uses to pick a client-registration strategy.

`/.well-known/oauth-authorization-server` (RFC 8414) simply **404s** for this issuer form, so the
richer metadata that WorkOS's own MCP guide assumes is never served.

This produced three distinct, dead-end failures:

1. **Claude Code CLI** — its OAuth client validates the discovery document against the full OIDC
   schema and rejected it outright:
   `expected array ... subject_types_supported ... id_token_signing_alg_values_supported`.

2. **claude.ai iPhone / web connector** — first reported *"Automatic client registration isn't
   supported by Generator Log. Edit the connector and add an OAuth Client ID"* (Claude could not
   detect DCR/CIMD because the flags are absent from the served metadata, even though **both DCR
   and CIMD were enabled** in the WorkOS dashboard — confirmed via the management API:
   `isAuthkitDynamicClientRegistrationEnabled: true`, `isAuthkitClientIdMetadataDocumentEnabled:
   true`). After manually entering the static client ID and registering Claude's fixed redirect URI
   (`https://claude.ai/api/mcp/auth_callback`), the flow then failed inside WorkOS with
   `https://error.workos.com/sso/invalid-connection-selector` — an enterprise-SSO error a bare
   OAuth client should never trigger against AuthKit's own hosted login.

All three trace back to the same root cause: **the default, non-custom-domain AuthKit issuer does
not expose the metadata surface WorkOS's MCP integration is designed around.**

## The only known fix, and why it was rejected

WorkOS's MCP examples use a **custom AuthKit domain** (e.g. `auth.yourdomain.com`), which serves the
complete `/.well-known/oauth-authorization-server` metadata. Configuring one requires a domain the
owner controls DNS for (to add the CNAME WorkOS verifies).

- The app's free Azure hostnames (`generatorlog.azurewebsites.net`,
  `generatorlog-api.azurewebsites.net`) **cannot** be used — Microsoft owns the `azurewebsites.net`
  zone, so no CNAME can be added there.
- `generatorlog.com` is registered to a third party (delegated to Cloudflare nameservers, no active
  zone), not the owner.

The project owner declined to purchase a domain for a non-professional, single-user hobby project.
With no custom domain, there is no viable path to a working OAuth handshake for the hosted Claude
surfaces, which were the entire reason OAuth (ADR 0005) was chosen over a simpler static bearer key.

## Options considered at the point of failure

1. **WorkOS custom domain** — the real fix; rejected (requires buying/owning a domain). ❌
2. **Local discovery-document shim** — have our backend proxy WorkOS's `openid-configuration` and
   inject the missing fields. Technically ~30–50 lines and $0, but the owner judged it too hacky to
   maintain, and it would not have fixed the `invalid-connection-selector` failure inside WorkOS. ❌
3. **Fall back to static bearer API key on `/mcp`** (the documented fallback in ADR 0005 / research
   0005 §A.5) — works for Claude Code + Routines but **drops claude.ai web/mobile connectors** (no
   custom headers), i.e. drops the iPhone app, which was the owner's primary goal. ❌
4. **File a Claude Code / WorkOS support ticket and wait** — no guaranteed timeline. ❌
5. **Abandon the feature.** ✅ Selected.

## Decision

**Abandon the MCP server integration.** The feature is removed from the roadmap. The implementation
branches (`feat/mcp-server-implementation`, `feat/agent-harness-and-mcp-research`) are deleted
locally and on the remote. No MCP code was ever merged to `main`; only the exploratory
research/ADR documents remain, retained as a record.

ADRs 0004–0007 are marked **Superseded by this ADR**. The REST toggle endpoint
(`POST /api/generator/toggle`, API-key auth per ADR 0003) is unchanged and remains the supported
automation surface — the **iOS Shortcuts** integration continues to provide iPhone start/stop, which
substantially covers the original "control it from my phone" goal without OAuth.

## Consequences

### Positive
- No dependency on WorkOS, no OAuth handshake surface, no `AUTHKIT_ISSUER`/`MCP_RESOURCE_URL`
  configuration to maintain, and no recurring "re-authenticate the connector" toil.
- The codebase on `main` stays smaller and has one auth scheme (API key for devices, session cookie
  for the web UI).

### Negative
- No conversational Claude control of the generator (iPhone app / claude.ai / Routines). The owner
  accepts this; iOS Shortcuts remain the phone-based control path.
- Scheduled monitoring (ADR 0006) and the email reduction it justified (ADR 0007) are moot; email
  notifications remain as they are on `main`.

### Follow-ups already applied alongside this decision
- Azure app settings `AUTHKIT_ISSUER`, `MCP_RESOURCE_URL`, `ENROLLMENT_MODE`, `OWNER_EMAIL` were set
  on `generatorlog-api` during MCP testing; they are inert without MCP code and may be removed at
  leisure (left in place — harmless, non-secret identifiers).
- The WorkOS Staging redirect URI `https://claude.ai/api/mcp/auth_callback` and the two OAuth
  resource indicators registered for testing can be deleted from the WorkOS dashboard; they are
  inert.

## References
- [ADR 0005 — OAuth-only via AuthKit](./0005-mcp-oauth-only-workos-authkit.md) (superseded)
- [Claude connector authentication](https://claude.com/docs/connectors/building/authentication) —
  callback URL `https://claude.ai/api/mcp/auth_callback`; DCR/CIMD detection requirements
- [WorkOS AuthKit MCP guide](https://workos.com/docs/authkit/mcp) — assumes a custom AuthKit domain
- OIDC Discovery 1.0 §3 — required metadata fields (`subject_types_supported`,
  `id_token_signing_alg_values_supported`)
