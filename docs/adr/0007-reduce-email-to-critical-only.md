# ADR 0007: Keep SMTP, Reduce Email Notifications to Maintenance-Critical Only

**Date**: 2026-07-04
**Status**: Accepted
**Deciders**: Ray Pabonnie, Claude Code
**Related Research**: [`docs/research/0005-mcp-oauth-and-scheduled-agent-research.md`](../research/0005-mcp-oauth-and-scheduled-agent-research.md), [`docs/research/0004-mcp-metrics-and-agent-alerts.md`](../research/0004-mcp-metrics-and-agent-alerts.md)
**Related ADRs**: [ADR 0006 (Routine monitoring)](./0006-scheduled-monitoring-claude-routine.md)

---

## Context and Problem Statement

Every generator stop currently sends an email: `sendGeneratorStopEmails()` in `backend/src/services/email.ts` branches to a maintenance reminder (threshold exceeded) or a stop confirmation (routine). With an agentic layer arriving (MCP + scheduled Claude Routine, ADRs 0004–0006), the user wants email reduced to a bare minimum.

Research 0004 (Goals 2 & 4) recommended ntfy.sh push notifications. During review the user **rejected ntfy.sh** — a third-party service with no established trust basis — and stated no additional push notifications are wanted; if no acceptable alternative exists, SMTP stays.

---

## Considered Options

### Option 1: Keep email-on-every-stop (status quo)
The original complaint — notification fatigue. ❌ Rejected.

### Option 2: ntfy.sh push (research 0004's recommendation)
❌ Rejected by the user: unvetted third party; no push notifications wanted. Supersedes research 0004 Goals 2 and 4.

### Option 3: Remove email entirely; Routine is the only notifier
No Claude-independent fallback for physical-maintenance alerts. SMTP also serves password-reset emails (`sendPasswordResetEmail()`), so the stack cannot be deleted anyway. ❌ Rejected.

### Option 4: Threshold-exceeded email only; Routine covers routine status ✅ Selected

---

## Decision

**Keep SMTP. Drop the per-stop confirmation email. Keep only the maintenance-threshold email.** The weekly Claude Routine (ADR 0006) provides routine status conversationally.

### Change (for a later implementation session — no code this round)

In the stop path of `backend/src/routes/generator.ts` / `backend/src/services/email.ts`: remove the `sendStopConfirmationEmail()` branch from `sendGeneratorStopEmails()` — equivalently, have the toggle route call the existing `sendMaintenanceAlertIfNeeded()` instead. `sendMaintenanceReminderEmail()` and `shouldSendMaintenanceReminder()` are unchanged. Existing email tests covering the stop-confirmation path are updated per the Test Failure Investigation Protocol.

---

## Consequences

### Positive
- Email volume drops from every-stop to a few per year (threshold breaches only)
- Zero new services, secrets, packages, or trust decisions
- The threshold email remains the Claude-independent safety net if the Routine or subscription lapses

### Negative
- No instant "generator stopped" confirmation on the phone — accepted; the dashboard and on-demand Claude queries cover it
- SMTP stack and its Key Vault secrets remain to maintain (also required by password reset regardless)

### Neutral
- Explicitly supersedes research 0004's ntfy.sh recommendations (Goals 2 & 4); those sections remain as historical record

---

## References

- [Research 0005 — Goal C](../research/0005-mcp-oauth-and-scheduled-agent-research.md)
- [Research 0004 — Goals 2 & 4 (superseded)](../research/0004-mcp-metrics-and-agent-alerts.md)
- Email service: `backend/src/services/email.ts`; toggle route: `backend/src/routes/generator.ts`
