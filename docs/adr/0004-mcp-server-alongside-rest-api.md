# ADR 0004: Add MCP Server Alongside Existing REST API

**Date**: 2026-06-29
**Status**: Proposed — iOS 27 verified (June 2026)
**Deciders**: Ray Pabonnie, Claude Code
**Related Research**: [`docs/research/0003-mcp-server-research.md`](../research/0003-mcp-server-research.md)

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

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGeneratorByApiKey, toggleGenerator } from '../services/generator.js';
import { z } from 'zod';

export function createMcpServer() {
  const server = new McpServer({ name: 'generatorlog', version: '1.0.0' });

  server.registerTool(
    'toggle_generator',
    {
      title: 'Toggle Generator',
      description:
        'Start or stop generator tracking. ' +
        'When stopped, automatically sends an email summary with runtime hours. ' +
        'Responds with current status (running/stopped), duration, and total hours.',
      inputSchema: z.object({
        api_key: z.string().describe('GeneratorLog API key (starts with gl_)'),
      }),
    },
    async ({ api_key }) => {
      const generator = await getGeneratorByApiKey(api_key);
      if (!generator) {
        return { content: [{ type: 'text', text: 'Invalid API key' }], isError: true };
      }
      const result = await toggleGenerator(generator.id);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );

  return server;
}
```

### 4. Authentication

Add an `onRequest` hook on the `/mcp` path that validates a Bearer token against the
existing API key store (same SHA-256 lookup as the REST endpoint). Reject connections
with no or invalid `Authorization: Bearer <api-key>` header before the MCP handshake completes.

### 5. Rate Limiting

Apply the existing `RateLimiter` to the `/mcp` path using the Bearer token as the client ID.

---

## Configuration for AI Clients

### Claude Desktop / Claude Code
```json
{
  "mcpServers": {
    "generatorlog": {
      "url": "https://<your-app>.azurewebsites.net/mcp",
      "headers": {
        "Authorization": "Bearer gl_<your-api-key>"
      }
    }
  }
}
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
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports.md)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [fastify-mcp on npm](https://www.npmjs.com/package/fastify-mcp)
- [ADR 0003 — Security (API key auth)](./0003-security-hashing-and-authentication.md)
