# Email Notification Research for Generator Maintenance Alerts

**Date:** 2026-02-20 (Updated)
**Status:** Research Complete - Awaiting Decision
**Context:** Need to send automated email alerts when generator maintenance is due (based on running hours OR months since last oil change)

## ⚠️ CRITICAL UPDATE: SendGrid Free Tier Discontinued

**SendGrid permanently discontinued its free tier in July 2025.** All previous recommendations based on SendGrid are no longer valid. This research has been updated with current alternatives that offer permanent free tiers.

## Requirements

1. Send automated email reminders for oil change maintenance
2. Deploy to Azure (App Service B1 or F1 Free tier)
3. Minimal external dependencies (per project philosophy)
4. Support for local/self-hosted deployment option
5. **Permanent free tier** for self-hosting use case (critical requirement)
6. Low cost for beta/production ($0-30/month budget)
7. Simple implementation (~50-200 lines of code preferred over heavy frameworks)

## Solutions Evaluated

### 1. Nodemailer + Brevo (Recommended) ⭐

**Description:** Use Nodemailer with Brevo (formerly Sendinblue), which offers a permanent free tier with generous limits.

**Implementation:**
- Install `nodemailer` and `node-cron` (npm packages)
- Configure with Brevo SMTP credentials
- Use `node-cron` for scheduling maintenance checks

**Brevo Free Tier (Permanent):**
- **300 emails/day** (~9,000/month)
- Free forever with proper usage
- No credit card required
- Includes transactional email features
- SMTP + API support

**Azure Compatibility:**
- ✅ Works on Azure App Service (all tiers)
- ✅ Authenticated SMTP on port 587 (no Azure restrictions)
- ✅ No Azure-specific configuration needed

**Code Complexity:** Low (~50-100 lines)

**Dependencies:**
```json
{
  "nodemailer": "^6.9.x",
  "node-cron": "^3.0.x"
}
```

**Pros:**
- ✅ Minimal dependencies (2 packages)
- ✅ **Permanent free tier** (9,000 emails/month)
- ✅ Most popular/documented solution (Nodemailer)
- ✅ Works locally and in cloud
- ✅ Simple implementation
- ✅ 300-900x more emails than typical usage (30-100 reminders/month)
- ✅ Supports HTML templates, attachments
- ✅ Strong deliverability
- ✅ All-in-one platform (can add marketing features later)

**Cons:**
- ❌ Requires external service account/credentials
- ❌ Third-party dependency for critical feature
- ❌ Daily limit (vs monthly) - but still 10x+ our needs

**Cost Estimate:**
- **Beta:** $0/month (Brevo free tier)
- **Production:** $0/month (free tier sufficient for 100+ users)
- **Scale-up:** $15/month for 20K emails if needed

**Typical Usage Calculation:**
- 100 users × 2 reminders/month = 200 emails/month
- Brevo free tier: 9,000/month
- Headroom: **45x** usage capacity

### 2. Nodemailer + MailerSend

**Description:** Use Nodemailer with MailerSend, a developer-focused email API with permanent free tier.

**MailerSend Free Tier (Permanent):**
- **3,000 emails/month**
- Free forever
- No credit card required
- API + SMTP support
- Template editor, analytics included

**Azure Compatibility:**
- ✅ Works on Azure (all tiers)
- ✅ SMTP on port 587

**Code Complexity:** Low (~50-100 lines)

**Dependencies:** Same as Brevo (nodemailer + node-cron)

**Pros:**
- ✅ Minimal dependencies (2 packages)
- ✅ **Permanent free tier** (3,000 emails/month)
- ✅ Developer-friendly API
- ✅ Good documentation
- ✅ 15-100x typical usage
- ✅ Built-in template editor

**Cons:**
- ❌ Requires external service account
- ❌ Lower monthly limit than Brevo (3K vs 9K)
- ❌ No marketing features (transactional only)

**Cost Estimate:**
- **Beta:** $0/month
- **Production:** $0/month (sufficient for 100+ users)

### 3. Nodemailer + SMTP2GO

**Description:** Use Nodemailer with SMTP2GO, a simple SMTP relay service.

**SMTP2GO Free Tier (Permanent):**
- **1,000 emails/month**
- Free forever
- Simple SMTP setup
- Basic analytics included

**Azure Compatibility:**
- ✅ Works on Azure (all tiers)

**Code Complexity:** Low (~50-100 lines)

**Pros:**
- ✅ Minimal dependencies (2 packages)
- ✅ **Permanent free tier** (1,000 emails/month)
- ✅ Very simple setup
- ✅ 5-33x typical usage
- ✅ Good for low-volume long-term

**Cons:**
- ❌ Lowest free tier limit (but still sufficient)
- ❌ Fewer features than alternatives

**Cost Estimate:**
- **Beta:** $0/month
- **Production:** $0/month (sufficient for 30-50 users)

### 4. Nodemailer + Resend

**Description:** Use Nodemailer with Resend, a modern developer-focused email API.

**Resend Free Tier:**
- **3,000 emails/month**
- Free tier available (check latest terms)
- API-first design
- React email component support

**Azure Compatibility:**
- ✅ Works on Azure

**Code Complexity:** Low (~50-100 lines)

**Pros:**
- ✅ Modern API
- ✅ Developer-friendly
- ✅ React component support

**Cons:**
- ❌ Newer service (less track record)
- ❌ Free tier permanence unclear

### 5. Self-Hosted with FreeResend + Amazon SES

**Description:** Self-host a Resend-compatible API using FreeResend (open source) + Amazon SES for actual sending.

**Implementation:**
- Deploy FreeResend (Node.js app) on your infrastructure
- Connect to Amazon SES for email delivery
- Use Resend-compatible API

**Amazon SES Pricing:**
- First 3,000 emails/month: **FREE** (when sending from AWS-hosted apps)
- After: $0.10 per 1,000 emails
- Very economical for scale

**Azure Compatibility:**
- ⚠️ FreeResend would need separate hosting
- ⚠️ SES free tier requires AWS-hosted app (doesn't apply to Azure)
- 💰 Would cost ~$0.30/month for 3K emails from Azure

**Code Complexity:** High (~200+ lines + infrastructure setup)

**Dependencies:**
```json
{
  "resend": "^1.x",  // or custom FreeResend client
  "node-cron": "^3.0.x"
}
```

**Pros:**
- ✅ Fully self-hosted option
- ✅ No third-party API dependencies
- ✅ Very low cost at scale ($0.10 per 1K)
- ✅ Complete control

**Cons:**
- ❌ Requires PostgreSQL for FreeResend
- ❌ Requires AWS account + SES setup
- ❌ Complex infrastructure (violates minimal dependencies philosophy)
- ❌ SES free tier doesn't apply to Azure deployments
- ❌ Deliverability setup (SPF, DKIM, domain verification)
- ❌ Operational overhead

**Cost Estimate:**
- **Beta:** $0-5/month (FreeResend hosting + SES)
- **Production:** $5-15/month

### 6. Azure Communication Services (ACS) Email

**Description:** Microsoft's first-party cloud email service with native Azure integration.

**Implementation:**
- Install `@azure/communication-email` SDK
- Configure Azure Communication Service in portal
- Verify custom domain (or use Azure-managed domain)

**Azure Compatibility:**
- ✅ Native Azure service

**Code Complexity:** Medium (~100-150 lines including Azure auth)

**Dependencies:**
```json
{
  "@azure/communication-email": "^1.x",
  "@azure/identity": "^4.x",
  "node-cron": "^3.0.x"
}
```

**Pros:**
- ✅ Cloud-native
- ✅ Azure SLA and support
- ✅ Native monitoring/alerting

**Cons:**
- ❌ **NOT suitable for local/self-hosted deployment** (critical requirement)
- ❌ More dependencies (Azure SDK)
- ❌ Requires Azure Portal setup
- ❌ Pricing unclear for low-volume use
- ❌ Ties project to Azure exclusively

**Cost Estimate:**
- **Beta:** ~$0-5/month
- **Production:** ~$5-15/month

### 7. Gmail SMTP (Development Only)

**Description:** Use Gmail's SMTP server for development and testing.

**Gmail SMTP:**
- 500 emails/day
- Requires App Password (OAuth2)
- Free

**Pros:**
- ✅ Free and easy for development
- ✅ No signup required (use personal account)

**Cons:**
- ❌ **NOT for production use**
- ❌ Risk of account suspension
- ❌ Not reliable for transactional emails
- ❌ Rate limits

**Use Case:** Local development only, switch to proper service before deployment

## Comparison Matrix

| Criteria | Brevo | MailerSend | SMTP2GO | Resend | FreeResend+SES | ACS Email | Gmail |
|----------|-------|------------|---------|--------|----------------|-----------|-------|
| **Free Tier** | 9K/mo | 3K/mo | 1K/mo | 3K/mo | ~$0.30/mo | ~$5/mo | Dev only |
| **Permanent Free** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Unclear | ❌ Paid | ❌ Paid | ✅ Yes |
| **Local Deploy** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Azure Compat** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Good | ⚠️ Complex | ✅ Native | ✅ Works |
| **Dependencies** | 2 packages | 2 packages | 2 packages | 2 packages | 2-3 + infra | 3 packages | 2 packages |
| **Complexity** | ✅ Low | ✅ Low | ✅ Low | ✅ Low | ❌ High | ⚠️ Medium | ✅ Low |
| **Deliverability** | ✅ Excellent | ✅ Excellent | ✅ Good | ✅ Good | ⚠️ DIY setup | ✅ Excellent | ❌ Poor |
| **Support** | ✅ Good | ✅ Good | ✅ Basic | ⚠️ Growing | ❌ Community | ✅ Azure | ❌ None |
| **Self-Host Viable** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Best | ❌ No | ⚠️ Dev only |

## Recommendation

**Solution: Nodemailer + Brevo (SMTP)**

### Rationale

1. **Best fit for project philosophy:**
   - Only 2 dependencies (`nodemailer`, `node-cron`) - both lightweight and focused
   - ~50-100 lines of clear, self-documenting code
   - Well-established packages (not reinventing the wheel for complex tasks)

2. **Meets all requirements:**
   - ✅ Works on Azure (all tiers, no special configuration)
   - ✅ Works locally (for development and self-hosted deployments)
   - ✅ **Permanent free tier** (9,000 emails/month)
   - ✅ $0 cost for beta AND production
   - ✅ 45x headroom over typical usage

3. **Self-hosting compatible:**
   - Users can run the app locally or on their own servers
   - Just need to configure SMTP credentials in environment variables
   - No Azure lock-in
   - No infrastructure dependencies

4. **AI-friendly:**
   - Extensive documentation and examples
   - Simple, predictable API
   - Easy for future AI agents to understand and modify

5. **Scalability:**
   - Brevo free tier: 9,000 emails/month (300/day)
   - Typical usage: ~30-100 users × 1-2 reminders/month = 30-200 emails/month
   - **45x-300x headroom on free tier**
   - Easy upgrade path if needed ($15-25/month for 20K-40K emails)

6. **Avoids over-engineering:**
   - Self-hosted SMTP is overkill for maintenance reminders
   - FreeResend+SES adds unnecessary infrastructure complexity
   - ACS ties project to Azure (violates self-hosting requirement)

### Why Not MailerSend or SMTP2GO?

Both are excellent alternatives:
- **MailerSend:** 3,000/month (15x+ headroom) - great choice if preferred
- **SMTP2GO:** 1,000/month (5x+ headroom) - sufficient but less buffer

**Brevo wins** because:
- 3x more free emails than MailerSend
- 9x more than SMTP2GO
- More room for growth without upgrading
- All-in-one platform (can add features later)

### Implementation Plan

```typescript
// 1. Install dependencies
npm install nodemailer node-cron

// 2. Configure in environment variables (.env)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<Brevo login email>
SMTP_PASSWORD=<Brevo SMTP key>
SMTP_FROM=noreply@yourdomain.com

// 3. Create email service (50-75 lines)
// - Initialize nodemailer transporter
// - Create sendMaintenanceReminder(user, generator) function
// - Handle errors gracefully

// 4. Create scheduler service (25-50 lines)
// - Use node-cron to check daily at 9am
// - Query generators where:
//   - (totalHours - lastOilChangeHours) >= oilChangeHours OR
//   - months_since(lastOilChangeDate) >= oilChangeMonths
// - Send reminder email to user
// - Log sent emails (store in DB to avoid duplicates)

// 5. Test with Brevo account
```

### Setup Instructions for Users

**Brevo Account Setup:**
1. Create free account at [brevo.com](https://www.brevo.com/)
2. Verify email address
3. Go to Settings > SMTP & API
4. Copy SMTP credentials
5. Add to `.env` file

**For Self-Hosting:**
- Users provide their own Brevo account credentials
- Or use any other SMTP provider (Gmail for dev, MailerSend, SMTP2GO, etc.)
- Just change environment variables - no code changes needed

## Alternative Providers (If Brevo Not Preferred)

All use the same Nodemailer implementation - just change SMTP settings:

| Provider | SMTP Host | Port | Free Tier | Setup |
|----------|-----------|------|-----------|-------|
| **Brevo** | smtp-relay.brevo.com | 587 | 9K/mo | [brevo.com](https://www.brevo.com/) |
| **MailerSend** | smtp.mailersend.net | 587 | 3K/mo | [mailersend.com](https://www.mailersend.com/) |
| **SMTP2GO** | mail.smtp2go.com | 2525/587 | 1K/mo | [smtp2go.com](https://www.smtp2go.com/) |
| **Resend** | smtp.resend.com | 587 | 3K/mo | [resend.com](https://resend.com/) |

## Next Steps

1. **Approval Required:** Confirm Brevo (or alternative) approach with user
2. **Create ADR:** Document decision in `docs/adr/0004-email-notifications.md`
3. **Implementation Tasks:**
   - Add environment variables to `.env.example`
   - Create `backend/src/services/email.ts`
   - Create `backend/src/services/scheduler.ts`
   - Add tests for email service (mock SMTP)
   - Update README with email configuration instructions
   - Document Brevo setup steps for self-hosting users

## References

- [Nodemailer Documentation](https://nodemailer.com/)
- [node-cron Documentation](https://nodecron.com/)
- [Brevo (Sendinblue) Free Tier](https://www.brevo.com/pricing/)
- [MailerSend Pricing](https://www.mailersend.com/pricing)
- [SMTP2GO Pricing](https://www.smtp2go.com/pricing/)
- [Azure SMTP Restrictions](https://docs.microsoft.com/en-us/azure/virtual-network/troubleshoot-outbound-smtp-connectivity)
- [SendGrid Free Tier Discontinuation (July 2025)](https://www.twilio.com/en-us/changelog/sendgrid-free-plan)
- [Transactional Email Services Comparison (2026)](https://mailtrap.io/blog/transactional-email-services/)
- [Best Free Transactional Email Services 2026](https://www.emailtooltester.com/en/blog/best-transactional-email-service/)
