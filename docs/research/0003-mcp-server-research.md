# MCP Server Research for GeneratorLog

**Date**: 2026-06-29
**Status**: Research Complete
**Author**: Claude Code

## Executive Summary

This document evaluates whether the existing REST API toggle endpoint (`POST /api/generator/toggle`)
used by iOS Shortcuts can be replaced by — or supplemented with — a Model Context Protocol (MCP)
server endpoint. The research covers MCP fundamentals, transport compatibility with iOS Shortcuts,
available TypeScript/Node.js libraries, Azure cost impact, and a final recommendation.

**Key Finding**: iOS Shortcuts **cannot** call an MCP endpoint directly. MCP's Streamable HTTP
transport requires a multi-step JSON-RPC initialization handshake that iOS Shortcuts has no
mechanism to perform. The REST endpoint must be retained for iOS Shortcuts.

**Recommendation**: Keep the REST endpoint for iOS Shortcuts and **add MCP alongside it** on the
same Fastify server using `@modelcontextprotocol/sdk` (official) + `fastify-mcp` (Fastify plugin).
Zero new infrastructure; Zod peer dependency already satisfied.

---

## 1. What Is MCP (Model Context Protocol)?

MCP is an open protocol (originally from Anthropic) that standardizes how AI clients — language
models, agents, coding assistants — communicate with tools and data sources. It uses **JSON-RPC 2.0**
as its message format.

### 1.1 Core Concepts

| Concept | Purpose |
|---------|---------|
| **Tools** | Callable actions with side effects (e.g., `toggle_generator`) — the LLM decides when to invoke |
| **Resources** | Read-only data the host app can attach as context (e.g., generator status, usage history) |
| **Prompts** | Reusable interaction templates for structured LLM workflows |

### 1.2 Transports (Current Spec: 2025-06-18)

MCP defines two standard transports:

#### stdio
- Client launches the MCP server as a **subprocess** and communicates via stdin/stdout
- Used by Claude Desktop, Cursor, Claude Code — local desktop integrations only
- **Not usable** for a cloud-deployed server

#### Streamable HTTP (current, replaces deprecated HTTP+SSE from 2024-11-05)
- Server operates as an independent process handling multiple HTTP connections
- Single endpoint (e.g., `https://example.com/mcp`) serves both `POST` and `GET`
- POST requests carry JSON-RPC messages; `GET` opens optional SSE streams for server-push
- **This is the transport for cloud-deployed MCP servers**

### 1.3 MCP Connection Lifecycle (Critical for iOS Analysis)

Every MCP session **MUST** begin with an initialization handshake before any tool can be called:

```
1. Client → Server: POST InitializeRequest
   Body: { "jsonrpc":"2.0", "id":1, "method":"initialize",
           "params": { "protocolVersion":"2025-06-18", "capabilities":{...}, "clientInfo":{...} } }

2. Server → Client: 200 OK with InitializeResponse + Mcp-Session-Id header
   Body: { "jsonrpc":"2.0", "id":1, "result":{ "protocolVersion":"2025-06-18", ... } }

3. Client → Server: POST InitializedNotification (must include Mcp-Session-Id header)
   Body: { "jsonrpc":"2.0", "method":"notifications/initialized" }

4. Server → Client: 202 Accepted

5. Client → Server: POST tools/call (must include Mcp-Session-Id header)
   Body: { "jsonrpc":"2.0", "id":2, "method":"tools/call",
           "params":{ "name":"toggle_generator", "arguments":{} } }
```

This 5-step flow happens before any useful work. iOS Shortcuts automation has no mechanism to
perform this handshake.

---

## 2. Can iOS Shortcuts Call an MCP Endpoint Directly?

**Answer: No.** Here is why:

### 2.1 What iOS Shortcuts Can Do

iOS Shortcuts' "Get Contents of URL" action supports:
- HTTPS requests with any HTTP method (GET, POST, PUT, DELETE)
- Custom request headers (e.g., `x-api-key`)
- JSON request body
- Reading JSON response fields for use in subsequent steps
- Storing values in variables between steps **within a single Shortcut execution**

This is sufficient to call a simple REST endpoint like `POST /api/generator/toggle`.

### 2.2 Why MCP Is Incompatible with iOS Shortcuts

| Requirement | iOS Shortcuts Capability | Verdict |
|-------------|--------------------------|---------|
| Perform multi-step HTTP handshake (initialize → initialized → call) | Each "Get Contents of URL" step is independent; variables can pass values forward BUT three coordinated HTTP steps would need to be manually wired with conditional logic | ❌ Technically possible but fragile |
| Send `Mcp-Session-Id` header (returned from step 2) to step 3 and 5 | Can read a header? **No.** iOS Shortcuts "Get Contents of URL" can read **response body** fields but **not response headers** | ❌ Hard blocker |
| Handle SSE streaming responses | Shortcuts cannot process Server-Sent Events streams | ❌ Hard blocker |
| Send `MCP-Protocol-Version` header on every request | Could hardcode this header | ✅ Possible |
| Send JSON-RPC 2.0 formatted body | Can construct JSON manually | ✅ Possible |

**The insurmountable blocker**: iOS Shortcuts cannot read HTTP response headers, making it impossible
to capture the `Mcp-Session-Id` value and include it in subsequent requests.

### 2.3 Bridge Options

| Bridge Approach | Description | Complexity | Recommended? |
|----------------|-------------|-----------|--------------|
| **Keep REST endpoint as-is** | iOS Shortcuts calls REST; AI agents call MCP | Zero extra complexity | ✅ Yes (recommended) |
| **Thin REST→MCP bridge** | Add a dedicated REST endpoint that internally performs the MCP handshake | Medium (~50 lines) | ⚠️ Adds complexity for no gain |
| **MCP-only + discard REST** | Remove REST endpoint | Forces non-standard iOS Shortcut | ❌ Breaks iOS integration |
| **Third-party iOS MCP client** | A hypothetical iOS app that can call MCP natively | Requires non-existent app | ❌ Not viable (2026) |

---

## 3. MCP Server Libraries for TypeScript/Node.js

### Option A: `@modelcontextprotocol/sdk` (Official SDK)

**npm**: `@modelcontextprotocol/sdk`
**Maintained by**: Anthropic / MCP project team
**License**: MIT
**Peer dependency**: `zod` ≥ 3.25 (already in `backend/package.json`) ✅

#### Overview
The reference implementation of the full MCP specification. Provides `McpServer` class,
`NodeStreamableHTTPServerTransport`, `StdioServerTransport`, and low-level `Server` class.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({ name: 'generatorlog', version: '1.0.0' });
server.registerTool('toggle_generator', { ... }, async () => { ... });
```

#### Strengths
- ✅ Official reference implementation — always in sync with spec
- ✅ Zero dependency on Zod beyond what project already has
- ✅ Full type safety and TypeScript-first design
- ✅ Stateless mode available — ideal for F1 tier
- ✅ Actively maintained; supports 2025-06-18 spec
- ✅ Minimal abstraction — no black-box magic

#### Weaknesses
- ⚠️ Session management not built-in (must manage `Map<sessionId, transport>` yourself)
- ⚠️ Fastify integration requires ~30 lines of glue code

---

### Option B: `fastify-mcp`

**npm**: `fastify-mcp`
**Maintained by**: haroldadmin (community)
**License**: MIT
**Dependencies**: `@modelcontextprotocol/sdk`, `fastify`

#### Overview
A Fastify plugin that wraps the official MCP SDK and handles session management and
transport registration natively within Fastify's plugin system.

```typescript
import { streamableHttp, Sessions } from 'fastify-mcp';

app.register(streamableHttp, {
  stateful: false,  // stateless = no SSE sessions, ideal for F1 tier
  mcpEndpoint: '/mcp',
  sessions: new Sessions<StreamableHTTPServerTransport>(),
  createServer,
});
```

#### Strengths
- ✅ Native Fastify plugin — zero glue code, idiomatic integration
- ✅ Handles both Streamable HTTP (current) and legacy HTTP+SSE transport
- ✅ Built-in session management the official SDK omits
- ✅ Stateless mode available — optimal for F1 tier
- ✅ Small, focused package — easy to audit

#### Weaknesses
- ⚠️ Community-maintained (not Anthropic) — may lag behind spec changes
- ⚠️ Adds a dependency on top of the official SDK
- ⚠️ Relatively new; smaller community

---

### Option C: `fastmcp`

**npm**: `fastmcp`
**Maintained by**: punkpeye (community)
**License**: MIT

#### Overview
An opinionated, "batteries-included" MCP framework that **manages its own HTTP server**.

#### Strengths
- ✅ Batteries-included: auth, CORS, HTTPS, custom REST routes built-in
- ✅ Both HTTP streaming and SSE transports supported
- ✅ Large community

#### Weaknesses
- ❌ **Manages its own HTTP server** — does not integrate into existing Fastify app
- ❌ Would require running two separate HTTP servers
- ❌ Adds significant dependency footprint
- ❌ Conflicts with minimal-dependency philosophy
- **Not recommended** for this project architecture

---

### Option D: `mcp-framework`

**npm**: `mcp-framework`
**Maintained by**: QuantGeekDev (community)
**License**: MIT

#### Overview
An opinionated, class-based framework with a CLI (`mcp create`, `mcp add tool`) for scaffolding.

#### Strengths
- ✅ CLI scaffolding speeds up initial setup
- ✅ Built-in auth (JWT, API Key, OAuth 2.1)
- ✅ Zod schemas for type-safe input validation

#### Weaknesses
- ❌ Heavy abstraction — hides MCP protocol details
- ❌ Does not integrate into existing Fastify app natively
- ❌ Overkill for a single-tool server
- **Not recommended** for adding MCP to an existing Fastify app

---

### Library Comparison Matrix

| Criterion | `@modelcontextprotocol/sdk` | `fastify-mcp` | `fastmcp` | `mcp-framework` |
|-----------|:---------------------------:|:-------------:|:---------:|:---------------:|
| Official / Anthropic maintained | ✅ | ❌ | ❌ | ❌ |
| Fastify-native integration | ⚠️ (glue needed) | ✅ | ❌ | ❌ |
| Session management built-in | ❌ | ✅ | ✅ | ✅ |
| Stateless mode (no SSE) | ✅ | ✅ | ❌ | ❌ |
| Minimal dependencies | ✅ | ⚠️ | ❌ | ❌ |
| Zod already in project | ✅ | ✅ | ✅ | ✅ |
| New infrastructure required | ❌ | ❌ | ⚠️ | ⚠️ |
| Appropriate for single-tool server | ✅ | ✅ | ⚠️ | ❌ |
| Agent-generated code quality | ✅ | ✅ | ⚠️ | ⚠️ |

---

## 4. Cost and Infrastructure Impact on Azure

### 4.1 No New Azure Services Required

Adding an MCP endpoint to the existing Fastify app requires **no new Azure resources**:

| Resource | Current | With MCP Added |
|----------|---------|----------------|
| Azure App Service | F1/B1 | Same F1/B1 — no change |
| PostgreSQL (Neon/Azure) | Same | Same — MCP tools use same DB |
| Monthly cost | $0–$13 | $0–$13 (no change) |

### 4.2 Azure F1 Tier Constraints vs. MCP

| F1 Constraint | Impact on MCP |
|---------------|--------------|
| 60 CPU minutes/day | MCP `tools/call` adds ~1-2ms per call — negligible |
| 1 GB RAM shared | MCP SDK + fastify-mcp add ~5 MB RAM — negligible |
| 120-second request timeout | **SSE streams must complete within 120s** — use stateless JSON mode |
| Shared instance (F1 only) | In-memory session state can be lost on restart — stateless mode mitigates |

**Key action**: Use stateless MCP mode (`stateful: false`) to return plain JSON responses instead
of SSE streams. This avoids long-lived connection issues on F1 shared infrastructure.

### 4.3 B1 Tier (Production)

On B1 (dedicated CPU, 1.75 GB RAM), stateful SSE connections work fine. However, stateless mode
is still preferable for simplicity — there's no need for session resumability on a single-tool server.

---

## 5. Dual-Use: AI Agents AND iOS Shortcuts

```
iOS Shortcuts
  └── POST /api/generator/toggle   (x-api-key header, JSON response)
        └── getGeneratorByApiKey() → toggleGenerator() → reply

Claude / Copilot / AI Agent
  └── POST /mcp   (MCP JSON-RPC protocol, initialize + tools/call)
        └── toggle_generator tool → getGeneratorByApiKey() → toggleGenerator()
```

Both paths share the same service functions, database, email logic, and rate limiter.

**MCP Authentication for single-user server**:
- Use existing API key in `Authorization: Bearer <api-key>` header during MCP initialization
- Validate with the same SHA-256 lookup as the REST endpoint
- Reject connections before the MCP handshake completes if token is invalid

---

## 6. REST API vs. MCP Endpoint Comparison

| Criterion | REST `POST /api/generator/toggle` | MCP `toggle_generator` tool |
|-----------|:---------------------------------:|:---------------------------:|
| iOS Shortcuts compatible | ✅ Native | ❌ Requires bridge |
| Claude / AI agent compatible | ❌ Requires manual tool definition | ✅ Native |
| Copilot / Claude Code compatible | ❌ | ✅ |
| Protocol complexity | Simple HTTP POST | JSON-RPC 2.0 + handshake |
| Authentication | `x-api-key` header | Bearer token |
| Discoverability | OpenAPI/Swagger needed | `tools/list` built-in |
| Self-describing to AI | ❌ (needs documentation) | ✅ (descriptions in tool schema) |
| Infrastructure change | None | None (same process) |
| Effort to add | Already exists | ~50–100 lines |

---

## 7. Recommended Approach

### Decision: Add MCP Alongside REST (Do Not Replace)

**Do NOT replace the REST endpoint** — iOS Shortcuts requires it and has no viable path to MCP.

**Add MCP as a parallel interface** on the same Fastify server using `@modelcontextprotocol/sdk`
+ `fastify-mcp`. This is the correct approach because:

1. **Zero infrastructure cost** — runs in the same Node.js process, same port
2. **Unlocks AI agent access** — Claude, Claude Code, Copilot control the generator via tool calls
3. **Self-describing** — `tools/list` tells AI clients what the server does without external docs
4. **Reuses existing business logic** — MCP tool calls `toggleGenerator()` service directly
5. **Stateless mode** — avoids SSE complexities on F1 tier
6. **Zod already present** — SDK peer dependency already satisfied

### Library Recommendation: `@modelcontextprotocol/sdk` + `fastify-mcp`

| New dependency | Purpose | Size | Risk |
|----------------|---------|------|------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | ~150KB | Low (Anthropic, stable) |
| `fastify-mcp` | Fastify plugin for MCP transport | ~20KB | Low-Medium (community, simple code) |

---

## References

- [MCP Specification 2025-06-18 — Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports.md)
- [MCP Specification 2025-06-18 — Lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle.md)
- [MCP Specification 2025-06-18 — Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools.md)
- [MCP Specification 2025-11-25 — Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP Specification 2025-11-25 — Lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP Roadmap (updated 2026-03-05)](https://modelcontextprotocol.io/development/roadmap.md)
- [MCP TypeScript SDK — server.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [npm: fastify-mcp](https://www.npmjs.com/package/fastify-mcp)
- [npm: fastmcp](https://www.npmjs.com/package/fastmcp)
- [npm: mcp-framework](https://www.npmjs.com/package/mcp-framework)
- [Apple Developer: App Intents — What's New June 2026](https://developer.apple.com/tutorials/data/documentation/updates/appintents.json)
- [Apple Developer: iOS What's New (iOS 27)](https://developer.apple.com/ios/whats-new/)
- [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/)
- [Apple Developer News Releases — iOS 27.0 beta](https://developer.apple.com/news/releases/)

---

## 8. iOS 27 Update (June 2026)

**Research date**: 2026-06-29
**iOS 27 status**: Beta 2 (build 24A5370h, released June 22, 2026). Not yet publicly released as of this writing.
**WWDC 2026**: Held June 9, 2026.

### 8.1 Has Apple Added MCP Support to iOS 27 Shortcuts?

**No.** A thorough review of WWDC 2026 materials and Apple developer documentation found
**zero evidence** of Apple shipping — or even announcing — MCP (Model Context Protocol)
support in iOS 27 Shortcuts:

- The official [App Intents June 2026 release notes](https://developer.apple.com/tutorials/data/documentation/updates/appintents.json)
  list new iOS 27 capabilities including `SyncableEntity`, `LongRunningIntent`,
  `CancellableIntent`, `UndoableIntent`, `RunSystemShortcutIntent`, `IntentModes`,
  `EntityCollection`, and `AppUnionValue`. All relate to Apple Intelligence / Siri
  integration. None relate to HTTP response header access, MCP protocol handling, or
  external tool-calling.
- The [iOS What's New page](https://developer.apple.com/ios/whats-new/) for iOS 27
  highlights the Foundation Models framework and App Intents expansion — no MCP mention.
- No "MCP action", "AI tool call", or "Call Remote Tool" step appears in the iOS 27 beta
  Shortcuts action library based on available documentation.
- A GitHub code search for `apple shortcuts MCP "model context protocol" ios27 wwdc2026`
  returned 0 results.

### 8.2 Can iOS 27 Shortcuts Read HTTP Response Headers?

**No evidence of any change.** "Get Contents of URL" is not listed in any iOS 27
documentation or WWDC 2026 session as having been updated to expose HTTP response headers.
This was the hard blocker identified in § 2.2 and it remains unresolved in iOS 27.

### 8.3 Foundation Models Framework — Not Relevant to Shortcuts MCP Calls

Apple's headline iOS 27 AI feature is the **Foundation Models framework**: a native Swift
API for on-device LLM access. From the iOS What's New page:

> _"The Foundation Models framework is a native Swift API that gives you direct access to
> the same on-device model that powers Apple Intelligence. You can now work with any
> language model, including Apple Foundation Models, cloud models like Claude and Gemini,
> or any other provider that conforms to the Language Model protocol."_

This enables developers to embed on-device AI inference **inside their own apps**. It has
no relationship to how the Shortcuts "Get Contents of URL" action handles HTTP requests and
does not add MCP protocol support to automation workflows.

Apple's AI integration strategy uses **App Intents / Siri** (compile-time intent
declarations) — not the MCP protocol. These ecosystems remain separate in iOS 27.

### 8.4 MCP Specification Update: 2025-06-18 → 2025-11-25

The canonical MCP specification version has advanced from `2025-06-18` to **`2025-11-25`**
(`modelcontextprotocol.io/specification/` now redirects to `2025-11-25`).

**Key change relevant to iOS Shortcuts** — `Mcp-Session-Id` is now **optional**:

> _"A server using the Streamable HTTP transport **MAY** assign a session ID at
> initialization time, by including it in an `MCP-Session-Id` header on the HTTP response
> containing the `InitializeResult`."_
>
> Source: [MCP Spec 2025-11-25 — Transports: Session Management](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

For a server running in **stateless mode** (no session ID assigned), the client never needs
to capture a response header — **technically lifting the hard blocker from § 2.2**.

**However, the 3-step initialization handshake remains MANDATORY** per the Lifecycle spec:

> _"The initialization phase **MUST** be the first interaction between client and server."_
>
> Source: [MCP Spec 2025-11-25 — Lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)

For a stateless server, iOS Shortcuts would still need to perform:
1. `POST /mcp` — `initialize` JSON-RPC request
2. `POST /mcp` — `notifications/initialized` JSON-RPC notification
3. `POST /mcp` — `tools/call` JSON-RPC request

This is 3 coordinated "Get Contents of URL" steps with manually constructed JSON-RPC
bodies and a hardcoded `MCP-Protocol-Version: 2025-11-25` request header. Possible in
principle, but fragile, non-native, and error-prone for a single toggle action.

**Updated compatibility table (iOS 27 / MCP spec 2025-11-25, stateless server):**

| Requirement | iOS Shortcuts Capability | Prior Verdict | Updated Verdict |
|-------------|--------------------------|---------------|-----------------|
| 3-step handshake (initialize → initialized → tools/call) | 3 sequential "Get Contents of URL" steps | ❌ Fragile | ⚠️ Still fragile — unchanged |
| Capture `Mcp-Session-Id` from response header | Cannot read response headers | ❌ **Hard blocker** | ✅ **Lifted** (stateless servers only) |
| Handle SSE streaming responses | Cannot process SSE streams | ❌ Hard blocker | ❌ Hard blocker (use stateless JSON mode) |
| Send `MCP-Protocol-Version` request header | Can hardcode in request headers | ✅ Possible | ✅ Possible — unchanged |
| Send JSON-RPC 2.0 formatted body | Can construct JSON manually | ✅ Possible | ✅ Possible — unchanged |
| Native "Call MCP Tool" action in Shortcuts | Does not exist | ❌ Not available | ❌ Not in iOS 27 |

### 8.5 MCP Roadmap — No Simplified Single-Request Mode

The [MCP roadmap (updated 2026-03-05)](https://modelcontextprotocol.io/development/roadmap.md)
describes "next-generation transport" work to improve stateless operation across load
balancers and proxies, but:

- No "skip-initialization" or single-request tool-call mode is proposed
- Explicitly states: _"We will **not** be introducing additional official transports this cycle."_
- The initialization handshake is a core part of MCP's capability-negotiation design and
  is not targeted for removal

### 8.6 Third-Party iOS MCP Client Apps (as of June 2026)

No App Store application was found that exposes MCP tool-calling as a native Shortcuts
action via an app extension. The "third-party iOS MCP client" option from § 2.3 remains
unavailable.

### 8.7 iOS 27 Verdict: Recommendation Unchanged

| Finding | Original (June 2026) | iOS 27 / MCP 2025-11-25 |
|---------|----------------------|--------------------------|
| iOS Shortcuts native MCP action | ❌ None | ❌ None — no change |
| "Get Contents of URL" reads response headers | ❌ No | ❌ No — no change |
| `Mcp-Session-Id` required (response header) | ❌ Hard blocker | ✅ Lifted for stateless servers |
| 3-step initialization handshake required | ⚠️ Fragile workaround | ⚠️ Fragile workaround — no change |
| Practical for iOS Shortcuts users | ❌ No | ❌ No — 3 manual JSON-RPC steps |
| Recommendation | Keep REST + add MCP | **Keep REST + add MCP — confirmed** |

**The recommendation from § 7 is unchanged.** iOS 27 does not introduce any capability
that makes MCP calls from iOS Shortcuts practical or advisable. The `POST /api/generator/toggle`
REST endpoint must be retained.

> **Note**: All future implementation work should reference the current `2025-11-25` spec,
> not the original `2025-06-18` spec used in §§ 1–7. Verify `@modelcontextprotocol/sdk`
> supports `2025-11-25` when implementing.
