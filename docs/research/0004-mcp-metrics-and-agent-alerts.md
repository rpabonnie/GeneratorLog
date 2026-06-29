# MCP Metrics/Monitoring Interface & Agent-Based Alerts Research

**Date**: 2026-06-29
**Status**: Research Complete
**Author**: Claude Code (research subagent)
**Depends on**: `docs/research/0003-mcp-server-research.md` (MCP transport, library selection already decided)

---

## Executive Summary

This document builds on the MCP transport research (0003) to answer four questions:

1. **What data should the MCP server expose** — Resources (read) vs Tools (actions) vs Prompts (templates) — and how should it be structured so an AI agent can assess generator health and maintenance needs?
2. **Should the email alert system be replaced or supplemented** with an agent-based monitoring layer?
3. **Can Copilot cloud agent automations act as a cron-based monitor** that calls the deployed Azure app and sends push notifications?
4. **What free or near-zero-cost notification services** can replace or supplement SMTP email?

**Key recommendations:**
- **Goal 1**: Expose 4 Resources + 3 Tools + 1 Prompt. Add a `generator://health` resource that pre-computes derived maintenance metrics so agents don't need to do math.
- **Goal 2**: Option C (Hybrid) — keep email as threshold fallback, add ntfy.sh push on every stop (zero cost), add weekly GitHub Actions assessment job.
- **Goal 3**: Use a standard GitHub Actions cron workflow (free tier), not Copilot cloud agent automations (paid plan required, not versioned in git).
- **Goal 4**: **ntfy.sh** is the clear winner for zero-cost push notifications. Telegram Bot is the runner-up.

---

## Goal 1: MCP as Rich Metrics/Monitoring Interface

### 1.1 Background: What Data Exists

The database schema (verified at `backend/src/db/schema.ts`) provides the following generator data:

| Table | Key Fields |
|-------|-----------|
| `generators` | `totalHours`, `oilChangeHours`, `oilChangeMonths`, `lastOilChangeHours`, `lastOilChangeDate`, `installedAt`, `isRunning`, `currentStartTime`, `name` |
| `usageLogs` | `startTime`, `endTime`, `durationHours` (per session) |
| `oilChangeHistory` | `performedAt`, `hoursAtChange`, `notes` |

This data is sufficient to answer every meaningful generator health question without any new sensors or inputs.

### 1.2 MCP Primitive Mapping: Resources vs Tools vs Prompts

| Primitive | Interaction Model | Side Effects | Best for |
|-----------|------------------|--------------|----------|
| **Resources** | Application-driven (host app decides when to include as context) | None | Read-only data the agent needs as background context |
| **Tools** | Model-controlled (LLM decides when to invoke) | Yes (writes/external calls) | Actions the agent can take |
| **Prompts** | User-controlled (user explicitly selects) | None | Reusable templates for structured workflows |

**The key design principle**: Resources are context, Tools are verbs. An agent can read all Resources passively during initialization, then decide which Tools to invoke based on context.

### 1.3 Option A: Minimal — Single `generator_status` Tool Only

Register one tool that returns everything in a single call.

**Pros:** Simple (~20 lines), single call covers every question.

**Cons:** Misuses Tools for read-only data. Every agent interaction fetches all data even when only a subset is needed. No passive context loading.

**Verdict**: Viable but suboptimal. Ignores the richer MCP features.

---

### 1.4 Option B: Resources-Only — No Tools

Expose all data as read-only Resources. Agent reads them but cannot take action via MCP.

**Cons:** Agent must call the REST endpoint separately with `x-api-key` to control the generator. Forces agents to know about two different protocols.

**Verdict**: Not recommended. Defeats the purpose of MCP as a unified agent interface.

---

### 1.5 Option C: Tools-Only — All Data Via Tool Calls

Register Tools for everything: `get_status`, `toggle_generator`, `record_oil_change`, `get_history`.

**Cons:** Misuses Tools for read-only operations. Host apps cannot attach Tool results as background context. Agent must actively call each tool before it has context.

**Verdict**: Better than A but still suboptimal for complex queries.

---

### 1.6 Option D: Resources + Tools + Prompt (Recommended) ⭐

Expose the full MCP surface correctly:

#### Resources (read-only, auto-loaded as context)

```
generator://status
  mimeType: application/json
  Returns:
    {
      name: string,
      isRunning: boolean,
      currentStartTime: string | null,
      currentRuntimeMinutes: number | null,  // computed: now - currentStartTime
      totalHours: number,
      lastUpdated: string
    }

generator://maintenance
  mimeType: application/json
  Returns:
    {
      hoursSinceLastOilChange: number,     // totalHours - lastOilChangeHours
      oilChangeHoursThreshold: number,
      hoursRemaining: number,              // threshold - hoursSinceChange (can be negative)
      hoursPercentUsed: number,            // 0–100+ (%)
      monthsSinceLastOilChange: number,
      oilChangeMonthsThreshold: number,
      monthsRemaining: number,
      monthsPercentUsed: number,
      maintenanceStatus: "ok" | "warning" | "overdue",
      lastOilChangeDate: string | null,
      lastOilChangeHours: number | null,
      oilChangeHistory: Array<{ performedAt: string, hoursAtChange: number, notes: string | null }>
    }

generator://history
  mimeType: application/json
  Returns:
    {
      recentSessions: Array<{ startTime: string, endTime: string | null, durationHours: number | null }>,
      totalSessionCount: number,
      averageSessionHours: number,
      longestSessionHours: number,
      sessionCountLast30Days: number,
      totalHoursLast30Days: number
    }

generator://health
  mimeType: application/json
  Returns:
    {
      // Pre-computed assessment for agent consumption
      overallStatus: "healthy" | "maintenance-soon" | "maintenance-due" | "overdue",
      maintenanceUrgency: "none" | "low" | "medium" | "high" | "critical",
      recommendedAction: "none" | "schedule-oil-change" | "change-oil-now" | "change-oil-overdue",
      summary: string,   // e.g. "87.3 of 100 hours used (87%). Oil change recommended within 2-3 uses."
      hoursToNextOilChange: number | null,
      estimatedRunsToOilChange: number | null,  // hoursToNextOilChange / averageSessionHours
      isRunning: boolean,
      currentRuntimeMinutes: number | null
    }
```

**Why `generator://health` matters**: This is the most important resource. It pre-computes the maintenance assessment using the same business logic already in `services/maintenance.ts`. An agent asking "should I change my oil?" simply reads this resource — it doesn't need to fetch raw numbers and do math itself. The `summary` field gives the agent a natural language fragment it can embed directly in its response.

#### Tools (actions with side effects)

```typescript
// Tool: toggle_generator
// Description: "Start or stop the generator. Returns the new running state, session duration
//               (if stopped), and total hours."
// Input schema: {} (no parameters — toggles current state)
// Returns: { status: "started" | "stopped", isRunning: boolean,
//            durationHours?: number, totalHours: number, startTime?: string }

// Tool: record_oil_change
// Description: "Record that an oil change was performed. Updates the maintenance clock."
// Input schema: { performedAt?: string (ISO 8601), notes?: string }
// Returns: { id: number, performedAt: string, hoursAtChange: number }

// Tool: update_maintenance_thresholds
// Description: "Update the generator's oil change thresholds."
// Input schema: { oilChangeHours?: number, oilChangeMonths?: number }
// Returns: { oilChangeHours: number, oilChangeMonths: number }
```

#### Prompt (user-controlled template)

```
Prompt: assess_maintenance
Description: "Generate a maintenance assessment and recommendation for the generator."

Message template:
  "You are a helpful generator maintenance assistant. Based on the generator status below,
   provide a clear, actionable maintenance recommendation in 2-3 sentences.

   Generator Health: {{generator://health}}
   Maintenance Details: {{generator://maintenance}}

   Answer the question: Should I change my oil now, soon, or can I wait?"
```

**Verdict for Option D**: ✅ **Recommended**. Correctly separates read-only context (Resources) from actions (Tools). The `generator://health` resource is the key addition. Adds ~150–200 lines total, all within the existing Fastify process, zero new infrastructure.

---

### 1.7 Summary Comparison: Goal 1

| Option | Resources | Tools | Prompts | Complexity | Agent Experience |
|--------|-----------|-------|---------|-----------|-----------------|
| A: Single Tool | ❌ | 1 | ❌ | Low | Poor — no passive context |
| B: Resources Only | 4 | ❌ | ❌ | Low | Incomplete — no control |
| C: Tools Only | ❌ | 4 | ❌ | Medium | OK but wastes tokens |
| **D: Full Surface** ⭐ | **4** | **3** | **1** | **Medium** | **Excellent** |

---

## Goal 2: Replace Email Alerts with Agent-Based Monitoring

### 2.1 Current Email Architecture

The current system (`backend/src/routes/generator.ts` + `services/email.ts`):
- Every generator stop fires `sendGeneratorStopEmails()`
- If threshold exceeded → maintenance reminder email (urgent)
- If below threshold → stop confirmation email (informational)

**Issues:** Email on every single stop causes notification fatigue. Binary threshold (no gradation). Email is pull (you check it); push is push (phone buzzes instantly).

---

### 2.2 Option A: Scheduled Agent Check (Cron + LLM)

A daily/weekly cron job reads the MCP endpoint, performs an LLM assessment, notifies only if warranted.

| Current email | Agent assessment |
|--------------|-----------------|
| "⚠️ Oil Change Required!" | "Your generator has run 87.3 hours since the last oil change (87%). Based on your typical 3-hour sessions, you have approximately 4 more uses before the change is due. No immediate action needed, but schedule maintenance within the next week." |

**Pros:** Natural language, proactive (warns at 80%), silences false alarms. LLM cost: ~$0.73/year.

**Cons:** Scheduled — misses immediate "you just stopped" feedback. No fallback.

---

### 2.3 Option B: On-Toggle LLM (Event-Driven Agent)

When generator stops, fire-and-forget LLM call from `setImmediate()` → send ntfy push.

```typescript
// In routes/generator.ts after status === 'stopped':
setImmediate(async () => {
  const assessment = await callLlmForAssessment({ durationHours, totalHours, hoursSinceOilChange, ... });
  await sendNtfyNotification({
    title: `Generator stopped — ${formatDuration(result.durationHours)}`,
    message: assessment.summary,
    priority: assessment.maintenanceUrgency === 'critical' ? 'high' : 'default',
  });
});
```

**Pros:** Immediate feedback seconds after stopping. Replaces both emails with one smarter message. Progressive urgency.

**Cons:** Adds LLM API key dependency. Cost ~$0.10/year. No fallback if LLM or ntfy is down.

---

### 2.4 Option C: Hybrid — Email Fallback + Agent Layer (Recommended) ⭐

Keep email for critical threshold breaches. Replace routine stop-confirmation emails with ntfy.sh push. Add weekly GitHub Actions assessment.

```
On generator stop (modified):
  ├── Always: POST ntfy.sh/$NTFY_TOPIC  ← raw stats push, no LLM
  │     title: "Generator stopped — 2h 15m"
  │     body: "45.2h / 100h since oil change (45%)"
  │     priority: warning if >80%, high if >100%
  │
  └── If maintenance threshold exceeded (existing logic):
        sendMaintenanceReminderEmail()  ← kept as-is, critical fallback

GitHub Actions cron (weekly, Monday 8 AM):
  → GET /api/generator/health
  → If warning|overdue: POST ntfy.sh with Claude assessment
  → If high|critical: create GitHub Issue (maintenance record)
```

**Implementation effort:** ~65 lines new code, ~15 lines modified.

**Pros:** Belt-and-suspenders. Email frequency drops dramatically. GitHub Issues create permanent maintenance log. ntfy.sh is zero-cost, zero new packages.

---

### 2.5 Option D: Drop-in Email Replacement — ntfy.sh Only

Remove all email code. Replace with ntfy.sh push. Same threshold logic.

**Pros:** Simplest migration. Removes SMTP dependency entirely.

**Cons:** Single point of failure. Loses maintenance email history. No fallback.

**Verdict**: Good for pure personal use where simplicity > robustness.

---

### 2.6 Goal 2 Summary Comparison

| Option | LLM Required | New Dependencies | Cost | Notification Type | Fallback | Effort |
|--------|------------|-----------------|------|-------------------|---------|--------|
| A: Scheduled Agent | Yes | LLM SDK + ntfy | ~$0.73/yr | ntfy push (daily) | None | Medium |
| B: On-Toggle LLM | Yes | LLM SDK + ntfy | ~$0.10/yr | ntfy push (on event) | None | Medium |
| **C: Hybrid** ⭐ | **Optional** | **ntfy only** | **$0** | **ntfy push + email fallback** | **Email** | **Low** |
| D: Drop-in ntfy | No | ntfy (fetch) | $0 | ntfy push (on event) | None | Low |

---

## Goal 3: Scheduled Workflows for Generator Monitoring

### 3.1 Option A: GitHub Copilot Cloud Agent Automations

Copilot cloud agent Automations can run on a schedule and create GitHub Issues with LLM-generated assessments.

**Key limitations:**
- Requires **Copilot Business/Pro+/Enterprise** plan — standard personal Copilot ($10/mo) does NOT include automations
- Automations are stored **outside git** — not versioned, not visible in code review
- Cannot send ntfy.sh push directly (limited to GitHub-native actions)

**Verdict**: Blocked by cost ($19+/user/month) and the "not versioned" problem.

---

### 3.2 Option B: Standard GitHub Actions Cron Workflow (Recommended) ⭐

```yaml
# .github/workflows/maintenance-check.yml
name: Generator Maintenance Check

on:
  schedule:
    - cron: '0 12 * * 1'   # Every Monday at noon UTC
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch generator health
        id: health
        run: |
          STATUS=$(curl -s \
            -H "x-api-key: ${{ secrets.GENERATOR_API_KEY }}" \
            "${{ vars.APP_URL }}/api/generator/health")
          echo "urgency=$(echo $STATUS | jq -r '.maintenanceUrgency')" >> $GITHUB_OUTPUT
          echo "summary=$(echo $STATUS | jq -r '.summary')" >> $GITHUB_OUTPUT

      - name: Send ntfy notification if needed
        if: steps.health.outputs.urgency != 'none'
        run: |
          curl -H "Title: Generator Maintenance Check" \
               -H "Tags: wrench" \
               -d "${{ steps.health.outputs.summary }}" \
               "https://ntfy.sh/${{ secrets.NTFY_TOPIC }}"

      - name: Create GitHub issue if maintenance due
        if: steps.health.outputs.urgency == 'high' || steps.health.outputs.urgency == 'critical'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner, repo: context.repo.repo,
              title: `Generator Maintenance Required — ${new Date().toISOString().split('T')[0]}`,
              body: `## Generator Health Report\n\n${{ steps.health.outputs.summary }}`,
              labels: ['maintenance']
            });
```

**GitHub Actions free tier:** 2,000 min/month for private repos. Weekly cron = ~52 min/year (2.6% of free allowance).

**Pros:** Free, versioned in git, works with existing agent harness, no plan upgrades required, ntfy.sh push + optional GitHub Issues.

---

### 3.3 Option C: GitHub Actions Cron + Claude API Assessment

Extends Option B with an Anthropic API call for natural language assessment.

**Cost:** Claude Haiku at ~$0.001/week = ~$0.05/year. Effectively zero. Requires `ANTHROPIC_API_KEY` in repository secrets.

---

### 3.4 Option D: In-Process Self-Assessment Endpoint

iOS Shortcut manually triggers `POST /api/generator/maintenance-check` weekly. Backend calls LLM, sends ntfy.

**Pros:** No GitHub Actions setup. **Cons:** Not automatic, requires iOS Shortcut to run.

---

### 3.5 Goal 3 Summary Comparison

| Option | Cost | Versioned in Git | LLM Assessment | Push Notification | Maintenance Log | Effort |
|--------|------|-----------------|---------------|-------------------|-----------------|--------|
| A: Copilot Automation | $19+/mo | ❌ | ✅ Copilot | ❌ (issues only) | ✅ Issues | Low |
| **B: GH Actions Cron** ⭐ | **$0** | **✅** | **Optional** | **✅ ntfy.sh** | **✅ Issues** | **Low** |
| C: GH Actions + Claude | ~$0.05/yr | ✅ | ✅ Claude | ✅ ntfy.sh | ✅ Issues | Low |
| D: In-Process Endpoint | ~$0.10/yr | ✅ | ✅ Claude | ✅ ntfy.sh | ❌ | Medium |

**Recommendation: Option B**, optionally upgraded to Option C by adding the Anthropic API call.

---

## Goal 4: Free/Zero-Cost Notification Alternatives to SMTP Email

### 4.1 Option A: ntfy.sh — Free Open-Source Push Service (Recommended) ⭐⭐⭐⭐⭐

**Cost:** $0 forever. iOS App Store app available.

```typescript
// backend/src/services/ntfy.ts — zero new packages, pure fetch
export async function sendPushNotification(opts: {
  title?: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  tags?: string[];    // e.g. ['warning', 'wrench'] — converted to emojis in app
  clickUrl?: string;
}): Promise<void> {
  if (!config.ntfy.topic) return;  // graceful no-op if not configured

  const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
  if (opts.title)    headers['Title']    = opts.title;
  if (opts.priority) headers['Priority'] = opts.priority;
  if (opts.tags)     headers['Tags']     = opts.tags.join(',');
  if (opts.clickUrl) headers['Click']    = opts.clickUrl;

  await fetch(`https://ntfy.sh/${config.ntfy.topic}`, {
    method: 'POST', headers, body: opts.message,
  });
}
```

**Sample notifications:**

| Event | Title | Message | Tags | Priority |
|-------|-------|---------|------|---------|
| Stopped (normal) | "Generator stopped — 2h 15m" | "45.2 / 100 hours since oil change (45%)" | white_check_mark | default |
| Stopped (warning) | "Generator stopped — 3h 02m" | "87.0 / 100 hours. Schedule oil change soon." | warning | default |
| Stopped (overdue) | "⚠️ Oil Change Required" | "103.4 hours — threshold exceeded! Change oil before next use." | rotating_light | high |

Free tier: 250 messages/day — single-user uses ~2/day. No account required. Open source.

---

### 4.2 Option B: Pushover — $5 One-Time Per Platform

**Cost:** $5 one-time iOS unlock. Zero ongoing cost. Extremely reliable since 2012.

**Differentiator**: Priority level 2 requires acknowledgement from the user — useful for critical oil change alerts that must not be dismissed.

---

### 4.3 Option C: GitHub Issues — Free, Zero Dependencies

Use the GitHub REST API to create Issues for maintenance events. GitHub mobile app pushes notifications.

**Best as:** A complement to ntfy.sh for maintenance-level events that need a permanent log. Poor as the only notification mechanism (not truly instant push).

---

### 4.4 Option D: Telegram Bot — Free, Rich Messages

Zero cost. Bot token + chat ID via @BotFather. Supports HTML formatting, inline keyboard buttons, message history as maintenance log. Works on iOS, Android, web.

---

### 4.5 Option E: Resend — Better Email API (if keeping email)

Replaces `nodemailer` + SMTP with Resend REST API. Free tier: 3,000/month. Better deliverability, no SMTP port/TLS configuration needed, one less credential to manage.

---

### 4.6 Goal 4 Summary Comparison

| Service | Cost | Setup Effort | iOS Push | New Packages | Best For |
|---------|------|-------------|----------|-------------|---------|
| **ntfy.sh** ⭐ | **$0** | **5 min** | **✅ App Store** | **0** | **Primary push** |
| Pushover | $5 one-time | 10 min | ✅ App Store | 0 | Primary push (if $5 ok) |
| GitHub Issues | $0 | 2 min | ✅ (GitHub app) | 0 | Maintenance log |
| Telegram Bot | $0 | 15 min | ✅ App Store | 0 | Rich messages |
| Resend (email) | $0 | 10 min | ❌ email only | 0 | Email replacement |

---

## Overall Recommendations Summary

| Goal | Recommendation | Effort | Cost |
|------|---------------|--------|------|
| **Goal 1** — MCP interface | 4 Resources + 3 Tools + 1 Prompt. Key: `generator://health` pre-computed summary | ~175 lines | $0 |
| **Goal 2** — Alert system | Hybrid: ntfy.sh push on every stop (no LLM), email kept for threshold-exceeded fallback | ~65 lines | $0 |
| **Goal 3** — Scheduled monitoring | Standard GitHub Actions cron (`.github/workflows/maintenance-check.yml`) | ~40 lines YAML | $0 |
| **Goal 4** — Push notifications | ntfy.sh as primary push + GitHub Issues as maintenance log | 25 lines (service) | $0 |

### Implementation Priority Order

1. Add `GET /api/generator/health` endpoint — needed by Goal 3 cron and as a standalone convenience
2. Add `services/ntfy.ts` (~25 lines, no packages) — needed by Goals 2 and 3
3. Modify toggle route — replace stop-confirmation email with ntfy.sh push; keep maintenance threshold email
4. Add MCP Resources — `generator://status`, `generator://maintenance`, `generator://history`, `generator://health`
5. Add MCP Tools — `toggle_generator`, `record_oil_change`, `update_maintenance_thresholds`
6. Add GitHub Actions cron — `.github/workflows/maintenance-check.yml`
7. Add MCP Prompt — `assess_maintenance`
8. Optional: GitHub Issues in the cron workflow as maintenance log

All steps are independent and can be implemented in any order.

---

## References

- MCP Resources specification: https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- MCP Tools specification: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP Prompts specification: https://modelcontextprotocol.io/specification/2025-11-25/server/prompts
- ntfy.sh documentation: https://docs.ntfy.sh/
- ntfy.sh publishing: https://docs.ntfy.sh/publish/
- Pushover API: https://pushover.net/api
- GitHub Copilot cloud agent Automations: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-automations
- GeneratorLog schema: `backend/src/db/schema.ts`
- GeneratorLog maintenance logic: `backend/src/services/maintenance.ts`
- GeneratorLog toggle route: `backend/src/routes/generator.ts`
- GeneratorLog email service: `backend/src/services/email.ts`
- Prior MCP research: `docs/research/0003-mcp-server-research.md`
