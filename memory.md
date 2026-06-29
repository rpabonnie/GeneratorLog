# Agent Memory — GeneratorLog

> **Append-only. Never edit or delete existing entries.**
> Format: `[YYYY-MM-DD HH:MM UTC] [agent_name] [CATEGORY] message`
> Categories: `DECISION` · `CONTEXT` · `ERROR` · `RESOLVED`
> When this file exceeds 200 lines, move entries older than 30 days to `memory_archive.md`.

---

## Active Memory

[2026-06-29 20:25 UTC] [bootstrap] [CONTEXT] Agent harness initialized for GeneratorLog. Stack: TypeScript / Node.js 25 · Fastify. Test command: pnpm --filter generatorlog-backend test.
