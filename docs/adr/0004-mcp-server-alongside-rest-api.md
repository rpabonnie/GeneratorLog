# ADR 0004: Add MCP Server Alongside Existing REST API

**Date**: 2026-06-29 (auth section revised 2026-07-04)
**Status**: **Superseded by [ADR 0008](./0008-abandon-mcp-integration.md)** — MCP feature abandoned 2026-07-24 (WorkOS AuthKit OAuth could not be completed without a custom domain). Original: Accepted — iOS 27 verified (June 2026); authentication superseded by [ADR 0005](./0005-mcp-oauth-only-workos-authkit.md)
**Deciders**: Ray Pabonnie, Claude Code
**Related Research**: [`docs/research/0003-mcp-server-research.md`](../research/0003-mcp-server-research.md), [`docs/research/0005-mcp-oauth-and-scheduled-agent-research.md`](../research/0005-mcp-oauth-and-scheduled-agent-research.md)

---

## Context and Problem Statement

GeneratorLog exposes a single authenticated REST endpoint (`POST /api/generator/toggle`) that
iOS Shortcuts calls to start and stop generator tracking. The question is whether this endpoint
should be replaced by, or supplemented with, a Model Context Protocol (MCP) server endpoint to
enable AI agent control (Claude, Copilot, Claude Code).

**Constraints**:
- Must not break the existing iOS Shortcuts integration
- Must stay within Azure App Service F1/B1 free/low-cost deployment
- No new paid cloud services
- Minimal-dependency philosophy
- Single user (personal home automation)

---

## Decision Drivers

1. **iOS Shortcuts compatibility** — The toggle action is triggered from an iPhone; the integration
   must continue working without a bridge app or complex multi-step Shortcut
2. **AI agent access** — Claude, Claude Code, and Copilot should be able to control the generator
   using natural MCP tool calls without requiring custom tool definitions outside the server
3. **Zero new infrastructure** — MCP must run on the existing App Service instance; no new services
4. **Minimal dependencies** — Per CLAUDE.md, only add a library if writing the code would take
   significant effort; prefer built-in patterns
5. **Stateless operation on F1** — Azure F1 has a 120-second request timeout and shared
   infrastructure that makes long-lived SSE streams unreliable

---

## Considered Options

### Option 1: Replace REST with MCP (MCP-only)
Remove the REST endpoint entirely; add an MCP server; iOS Shortcuts calls MCP.

**Verdict**: ❌ Rejected. iOS Shortcuts cannot call MCP directly. MCP Streamable HTTP requires a
multi-step JSON-RPC initialization handshake including capture of the `Mcp-Session-Id` response
header — iOS Shortcuts cannot read HTTP response headers.

### Option 2: Keep REST, Skip MCP (status quo)
Do not add MCP; AI agents manually define tool wrappers against the REST API.

**Verdict**: ⚠️ Viable but suboptimal. AI agents can call REST endpoints but lack auto-discovery,
self-describing tool schemas, and the semantic richness of a proper MCP tool definition.

### Option 3: Add MCP Alongside REST (dual-interface)
Keep `POST /api/generator/toggle` for iOS Shortcuts; add `POST /mcp` for AI agents on the same
Fastify process.

**Verdict**: ✅ Selected. Zero infrastructure cost, iOS unchanged, AI agents gain native access.

### Option 4: REST + Thin REST→MCP Bridge
Keep REST for iOS; add another REST endpoint that internally performs the MCP handshake.

**Verdict**: ❌ Rejected. Adds complexity without benefit over Option 3.

---

## Decision

**Add MCP as a parallel interface alongside the existing REST endpoint.**

- `POST /api/generator/toggle` — Retained unchanged for iOS Shortcuts
- `POST /mcp` — New MCP Streamable HTTP endpoint for AI agent access (Claude, Copilot, Claude Code)

Both endpoints call the same `toggleGenerator()` service function in `backend/src/services/generator.ts`.

### Library Decision: `@modelcontextprotocol/sdk` + `fastify-mcp`

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | latest | Official MCP protocol implementation |
| `fastify-mcp` | latest | Fastify plugin handling transport + session management |

`zod` is already a project dependency — the SDK's peer dependency is already satisfied.
Net new packages: 2.

**Alternative**: Use `@modelcontextprotocol/sdk` alone without `fastify-mcp`. This requires ~40 lines
of manual session management code. Given the project's preference for generated code over external
libraries, this is a reasonable alternative for Claude Code agents to implement if the `fastify-mcp`
dependency is unwanted.

---

## Implementation Plan

### 1. New files

```
backend/src/mcp/
  tools.ts        — McpServer factory with toggle_generator tool
  auth.ts         — Bearer token validation middleware for MCP endpoint
```

### 2. Changes to `backend/src/index.ts`

Register the `fastify-mcp` plugin after all existing routes:

```typescript
import { streamableHttp, Sessions } from 'fastify-mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp/tools.js';

// MCP endpoint — stateless mode, plain JSON responses, no SSE streams
server.register(streamableHttp, {
  stateful: false,
  mcpEndpoint: '/mcp',
  sessions: new Sessions<StreamableHTTPServerTransport>(),
  createServer: createMcpServer,
});
```

### 3. Tool definition (`backend/src/mcp/tools.ts`)

Tools take **no credentials** — authentication happens at the transport level before any tool
runs (see § 4). The authenticated user's generator is resolved from the request context.

> **Revision 2026-07-04**: an earlier sketch passed `api_key` as a tool input parameter. That was
> wrong — the key would sit in every agent conversation context. Never accept credentials as tool
> arguments.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toggleGenerator, getGeneratorForUser } from '../services/generator.js';

export function createMcpServer(userId: number) {
  const server = new McpServer({ name: 'generatorlog', version: '1.0.0' });

  server.registerTool(
    'toggle_generator',
    {
      title: 'Toggle Generator',
      description:
        'Start or stop generator tracking. ' +
        'Responds with current status (running/stopped), duration, and total hours.',
    },
    async () => {
      const generator = await getGeneratorForUser(userId);
      const result = await toggleGenerator(generator.id);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  server.registerTool(
    'get_generator_health',
    {
      title: 'Get Generator Health',
      description:
        'Read-only pre-computed health assessment: maintenance status, urgency, ' +
        'recommended action, and a natural-language summary.',
    },
    async () => {
      const health = await getGeneratorHealth(userId); // same logic as generator://health resource
      return { content: [{ type: 'text', text: JSON.stringify(health) }] };
    }
  );

  return server;
}
```

> **Owner tooling (added 2026-07-04)**: the implementation must also include a read-only
> `list_enrollments` tool (owner-scoped) returning registered users (id, email, name, createdAt)
> so the owner can review sign-ups via MCP. Complements the enrollment alert email
> (`OWNER_EMAIL`) added to the enroll route.

**Why `get_generator_health` as a tool when `generator://health` exists as a resource**: agent
surfaces invoke Tools far more reliably than Resources (resources are user-attached in Claude
clients). Mirroring the health resource as a read-only tool lets any agent — including the
scheduled Routine (ADR 0006) — query health without resource support.

### 4. Authentication

> **Superseded by [ADR 0005](./0005-mcp-oauth-only-workos-authkit.md)** (2026-07-04):
> `/mcp` is **OAuth-only** via WorkOS AuthKit — an `onRequest` hook validates AuthKit-issued
> JWTs against the AuthKit JWKS and returns `401` (with RFC 9728 resource metadata) otherwise.
> There is no API-key path on `/mcp`. The `gl_` API key + `x-api-key` header remains exclusively
> on the iOS Shortcuts REST endpoint (ADR 0003, unchanged).

### 5. Rate Limiting

Apply the existing `RateLimiter` to the `/mcp` path using the OAuth token subject as the client ID.

---

## Configuration for AI Clients

All Claude surfaces (claude.ai/mobile custom connectors, Claude Code, cloud Routines)
authenticate via the OAuth flow — no headers or keys to configure (ADR 0005).

### claude.ai / Claude mobile
Settings → Connectors → Add custom connector → URL `https://generatorlog-api.azurewebsites.net/mcp`
→ complete the AuthKit sign-in when prompted.

### Claude Code
```bash
claude mcp add --transport http generatorlog https://generatorlog-api.azurewebsites.net/mcp
# First use returns 401 → run /mcp and complete the browser sign-in once
```

### iOS Shortcuts (unchanged)
```
GET CONTENTS OF URL
URL: https://<your-app>.azurewebsites.net/api/generator/toggle
Method: POST
Headers: x-api-key = gl_<your-api-key>
```

---

## Consequences

### Positive
- iOS Shortcuts integration is completely unchanged — no migration required
- Claude, Claude Code, and Copilot can control the generator natively via MCP tools
- `tools/list` provides self-describing discovery without external documentation
- Zero new infrastructure; runs in the same Node.js process on the existing App Service
- Stateless JSON mode avoids F1 tier SSE timeout issues
- MCP tool reuses all existing service functions — no business logic duplication
- `zod` peer dependency already satisfied

### Negative
- Two new npm packages to maintain (`@modelcontextprotocol/sdk` + `fastify-mcp`)
- MCP spec is still evolving; breaking changes possible
- `fastify-mcp` is community-maintained and may lag the official spec
- MCP authentication best practices for remote servers are still maturing
- Adds ~100 lines of new code to maintain

### Neutral
- The REST endpoint becomes iOS-only "legacy"; MCP becomes the primary agent interface.
  Both should be documented and tested.

---

## Testing

- Unit tests: Mock `toggleGenerator()`, verify MCP tool returns correct JSON-RPC responses
- Integration test: Full MCP handshake (initialize → initialized → tools/call) against test server
- Regression: Existing REST endpoint tests remain green

---

## References

- [Research Document](../research/0003-mcp-server-research.md)
- [ADR 0005 — MCP OAuth via WorkOS AuthKit](./0005-mcp-oauth-only-workos-authkit.md)
- [ADR 0006 — Scheduled monitoring via Claude Routine](./0006-scheduled-monitoring-claude-routine.md)
- [MCP Specification 2025-11-25 (current — use this for implementation)](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [fastify-mcp on npm](https://www.npmjs.com/package/fastify-mcp)
- [ADR 0003 — Security (API key auth)](./0003-security-hashing-and-authentication.md)
