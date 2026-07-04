# ADR 0006: Scheduled Generator Monitoring via Claude Code Cloud Routine

**Date**: 2026-07-04
**Status**: Accepted
**Deciders**: Ray Pabonnie, Claude Code
**Related Research**: [`docs/research/0005-mcp-oauth-and-scheduled-agent-research.md`](../research/0005-mcp-oauth-and-scheduled-agent-research.md)
**Related ADRs**: [ADR 0004 (MCP endpoint)](./0004-mcp-server-alongside-rest-api.md), [ADR 0005 (MCP OAuth)](./0005-mcp-oauth-only-workos-authkit.md), [ADR 0007 (email reduction)](./0007-reduce-email-to-critical-only.md)

---

## Context and Problem Statement

The user wants Claude to periodically query the generator service over MCP and report on health and maintenance — "Claude as the agent on a schedule." Research 0004 (Goal 3) predates Claude Code cloud Routines and recommended a GitHub Actions cron workflow with ntfy.sh notifications; both legs of that recommendation are now superseded (Routines exist; ntfy.sh was rejected, see ADR 0007).

**Constraints**: $0 incremental cost; must not depend on the user's workstation being on; no new credentials to manage (per ADR 0005).

---

## Considered Options

### Option 1: GitHub Actions cron (research 0004's pick)
Free, versioned in git, deterministic — but not "Claude as the agent" (no conversational assessment without extra API billing), requires a repo secret for the health endpoint, and its notification leg assumed ntfy.sh. ❌ Superseded for this role; remains a documented future fallback.

### Option 2: Claude Desktop local scheduled task
Requires the user's machine to be on. A generator monitor must not depend on a workstation. ❌ Rejected.

### Option 3: In-process cron + Anthropic API call
Adds an API key to manage (contradicts ADR 0005's "no more API keys") plus LLM billing setup. ❌ Rejected.

### Option 4: Claude Code cloud Routine ✅ Selected
A named, cron-scheduled invocation of Claude Code in Anthropic's managed cloud (shipped ~April 2026; minimum interval 1 hour), with access to granted MCP servers. Runs on the existing Claude subscription.

---

## Decision

**A Claude Code cloud Routine is the sole scheduled monitor.** It connects to the `/mcp` endpoint using the same OAuth connection as interactive sessions (ADR 0005) and reports conversationally.

### Routine definition (create at implementation time; recorded here because Routine config lives in Claude's cloud, not in git)

- **Name**: `generator-weekly-health-check`
- **Schedule**: weekly, Monday 08:00 local (`0 13 * * 1` UTC)
- **MCP server granted**: `generatorlog` (`https://generatorlog-api.azurewebsites.net/mcp`)
- **Prompt**:

> Check my generator using the generatorlog MCP server. Read the health resource (or call `get_generator_health`). If maintenance status is `warning` or worse, tell me plainly what to do and how urgent it is, estimating how many typical runs remain before the oil change is due. If everything is healthy, reply with one short sentence confirming it. The server may take up to 30 seconds to respond on the first call (cold start) — retry once if the first attempt times out.

---

## Consequences

### Positive
- Exactly the requested experience: natural-language health assessments on a schedule, $0 incremental
- No infrastructure, no deploy artifacts, no credentials beyond the existing OAuth connection
- Frequency and prompt are adjustable in seconds, or invoked ad hoc ("check my generator now")

### Negative
- Depends on an active Claude subscription; if it lapses, scheduled monitoring stops — the threshold-exceeded email (ADR 0007) remains as the Claude-independent safety net
- Routine configuration is not versioned in git — mitigated by recording the full definition in this ADR
- Headless runs rely on OAuth refresh-token renewal (see ADR 0005 operational note)
- Azure F1 has no Always-On: first request after idle cold-starts (~10–30 s); the Routine prompt accounts for this

### Neutral
- Supersedes research 0004 Goal 3 (GitHub Actions cron), which stays documented as a fallback if a git-versioned, subscription-independent monitor is ever needed

---

## References

- [Research 0005 — Goal B](../research/0005-mcp-oauth-and-scheduled-agent-research.md)
- [Claude Code scheduled tasks & Routines](https://code.claude.com/docs/en/scheduled-tasks)
- [Research 0004 — Goal 3 (superseded)](../research/0004-mcp-metrics-and-agent-alerts.md)
