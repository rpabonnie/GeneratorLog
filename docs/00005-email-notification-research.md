# Email Notification Research for Generator Maintenance Alerts

**Date:** 2026-02-20
**Status:** Research Complete - Awaiting Decision
**Context:** Need to send automated email alerts when generator maintenance is due (based on running hours OR months since last oil change)

## Requirements

1. Send automated email reminders for oil change maintenance
2. Deploy to Azure (App Service B1 or F1 Free tier)
3. Minimal external dependencies (per project philosophy)
4. Support for local/self-hosted deployment option
5. Low cost for beta/production ($0-30/month budget)
6. Simple implementation (~50-200 lines of code preferred over heavy frameworks)

## Solutions Evaluated

### 1. Nodemailer + External SMTP Service

**Description:** Use the Nodemailer library (most popular Node.js email library) with a third-party SMTP provider (Gmail, SendGrid, etc.)

**Implementation:**
- Install `nodemailer` (npm package)
- Configure with SMTP credentials from provider
- Use `node-cron` for scheduling maintenance checks

**Providers Comparison:**

| Provider | Free Tier | Best For | Pros | Cons |
|----------|-----------|----------|------|------|
| **SendGrid** | 100/day (~3,000/month) | Ongoing small projects | Generous free tier, good docs, scalable | Daily limit, costs rise quickly |
| **Mailgun** | 5,000/month (first 30 days), then 100/day | API-first apps, trial period | Great API, analytics, flexible | Limited after trial, technical setup |
| **Postmark** | 100/month | Critical transactional only | Fastest delivery, excellent support | Very limited free tier |
| **Gmail SMTP** | 500/day | Development/testing | Free, easy setup | Not for production, risk of account suspension |

**Azure Compatibility:**
- Works on Azure App Service (all tiers)
- Note: Azure blocks outbound port 25 (raw SMTP) on basic VMs, but authenticated SMTP on ports 587/465 works fine
- No Azure-specific configuration needed

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
- ✅ Most popular/documented solution
- ✅ Works locally and in cloud
- ✅ Simple implementation
- ✅ SendGrid free tier covers typical usage (3,000 emails/month >> maintenance reminders)
- ✅ Supports HTML templates, attachments if needed later

**Cons:**
- ❌ Requires external service account/credentials
- ❌ Third-party dependency for critical feature
- ❌ SendGrid OAuth2 setup can be complex
- ❌ Free tier limits could be restrictive for multi-user scaling

**Cost Estimate:**
- **Beta:** $0/month (SendGrid free tier)
- **Production:** $0-15/month depending on user count

### 2. Azure Communication Services (ACS) Email

**Description:** Microsoft's first-party cloud email service with native Azure integration

**Implementation:**
- Install `@azure/communication-email` SDK
- Configure Azure Communication Service in portal
- Verify custom domain (or use Azure-managed domain)
- Use Azure AD or API keys for authentication

**Azure Compatibility:**
- ✅ Native Azure service
- ✅ Integrates with Azure Identity, Monitoring, Key Vault
- ✅ Built-in retry, suppression list management

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
- ✅ Cloud-native, no third-party SMTP credentials
- ✅ Highly scalable and secure
- ✅ Azure SLA and support
- ✅ Native monitoring/alerting
- ✅ Good fit for Azure-only deployment

**Cons:**
- ❌ Requires Azure Portal setup (domain verification, resource creation)
- ❌ More dependencies (Azure SDK)
- ❌ NOT suitable for local/self-hosted deployment
- ❌ Less community documentation than Nodemailer
- ❌ Pricing unclear for low-volume use
- ❌ Service still evolving (fewer features than mature alternatives)

**Cost Estimate:**
- **Beta:** ~$0-5/month (Azure Communication Services pricing)
- **Production:** ~$5-15/month
- Note: Requires Azure account with payment method even for free tier

### 3. Self-Hosted SMTP Server (Haraka)

**Description:** Run your own lightweight SMTP server using Haraka (Node.js-based)

**Implementation:**
- Install Haraka via npm
- Configure as lightweight SMTP relay
- Deploy alongside main app or as separate container
- Use Nodemailer to send via local Haraka instance

**Azure Compatibility:**
- ⚠️ Requires dedicated container or VM
- ⚠️ Need static outbound IP or relay service for deliverability
- ⚠️ Azure blocks port 25, requires relay setup

**Code Complexity:** High (~200-500 lines for Haraka config + app integration)

**Dependencies:**
```json
{
  "haraka": "^3.x",
  "nodemailer": "^6.9.x",
  "node-cron": "^3.0.x"
}
```

**Pros:**
- ✅ No third-party service dependency
- ✅ Full control over email delivery
- ✅ No per-email costs
- ✅ Works locally and cloud

**Cons:**
- ❌ Significant setup and maintenance overhead
- ❌ Complex deliverability (SPF, DKIM, DMARC configuration)
- ❌ IP reputation management needed
- ❌ Emails likely to be marked as spam without proper setup
- ❌ Violates "minimal dependencies" philosophy (heavy operational burden)
- ❌ Not suitable for $0 Azure free tier (needs additional resources)

**Cost Estimate:**
- **Beta:** Not practical on F1 Free tier
- **Production:** +$10-30/month (additional container/VM resources)

### 4. Custom SMTP Client (Pure Node.js)

**Description:** Write a minimal SMTP client from scratch using Node.js `net` or `tls` modules

**Implementation:**
- Implement SMTP protocol manually (~200-300 lines)
- Connect directly to recipient MX servers
- No external libraries

**Azure Compatibility:**
- ❌ Azure blocks port 25 (SMTP)
- ❌ Would require SMTP relay anyway, defeating the purpose

**Code Complexity:** Very High (~300-500 lines for robust implementation)

**Dependencies:** None (stdlib only)

**Pros:**
- ✅ Zero dependencies
- ✅ Educational value

**Cons:**
- ❌ Violates "only add a library if writing the code would take significant effort" guideline
- ❌ Reinventing the wheel
- ❌ No authentication, TLS, or modern SMTP features without significant work
- ❌ Poor deliverability (no DKIM, SPF)
- ❌ Azure port 25 restriction makes this impractical
- ❌ High maintenance burden for future AI-generated code

**Cost Estimate:**
- Not viable due to Azure restrictions

## Comparison Matrix

| Criteria | Nodemailer + SMTP | Azure Comm Services | Self-Hosted (Haraka) | Custom SMTP |
|----------|-------------------|---------------------|----------------------|-------------|
| **Minimal Dependencies** | ✅ Excellent (2 packages) | ⚠️ Good (3 packages) | ❌ Poor (3+ packages + ops) | ✅ Perfect (0 packages) |
| **Implementation Complexity** | ✅ Low | ⚠️ Medium | ❌ High | ❌ Very High |
| **Azure Compatibility** | ✅ Excellent | ✅ Native | ⚠️ Possible but complex | ❌ Blocked |
| **Local Deployment** | ✅ Yes | ❌ No | ✅ Yes | ⚠️ Difficult |
| **Cost (Beta)** | ✅ $0 | ⚠️ $0-5 | ❌ Not viable | ❌ Not viable |
| **Cost (Production)** | ✅ $0-15 | ⚠️ $5-15 | ❌ $10-30+ | ❌ N/A |
| **Maintenance Burden** | ✅ Low | ⚠️ Medium | ❌ High | ❌ Very High |
| **Deliverability** | ✅ Excellent (provider-managed) | ✅ Excellent | ⚠️ Poor (requires work) | ❌ Very Poor |
| **Community Support** | ✅ Extensive | ⚠️ Growing | ⚠️ Limited | ❌ DIY |
| **AI Code Generation** | ✅ Well-suited | ⚠️ Moderate | ❌ Complex | ❌ Not recommended |

## Recommendation

**Solution: Nodemailer + SendGrid (SMTP)**

### Rationale

1. **Best fit for project philosophy:**
   - Only 2 dependencies (`nodemailer`, `node-cron`) - both lightweight and focused
   - ~50-100 lines of clear, self-documenting code
   - Well-established packages (not reinventing the wheel for complex tasks)

2. **Meets all requirements:**
   - ✅ Works on Azure (all tiers, no special configuration)
   - ✅ Works locally (for development and self-hosted deployments)
   - ✅ $0 cost for beta (SendGrid 3,000/month >> maintenance reminders)
   - ✅ Low cost for production (free tier covers most scenarios)

3. **AI-friendly:**
   - Extensive documentation and examples
   - Simple, predictable API
   - Easy for future AI agents to understand and modify

4. **Scalability:**
   - SendGrid free tier: 3,000 emails/month
   - Typical usage: ~30-100 users × 1-2 reminders/month = 30-200 emails/month
   - 15x-100x headroom on free tier
   - Easy upgrade path if needed ($15/month for 40K emails)

5. **Avoids over-engineering:**
   - Self-hosted SMTP is overkill for maintenance reminders
   - Custom SMTP client violates project principles
   - ACS ties project to Azure unnecessarily

### Implementation Plan

```typescript
// 1. Install dependencies
npm install nodemailer node-cron

// 2. Configure in environment variables
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<SendGrid API key>
SMTP_FROM=noreply@yourdomain.com

// 3. Create email service (50-75 lines)
// - Initialize nodemailer transporter
// - Create sendMaintenanceReminder(user, generator) function
// - Handle errors gracefully

// 4. Create scheduler service (25-50 lines)
// - Use node-cron to check daily (or on app startup)
// - Query generators where:
//   - (totalHours - lastOilChangeHours) >= oilChangeHours OR
//   - months_since(lastOilChangeDate) >= oilChangeMonths
// - Send reminder email to user
// - Log sent emails (optional: store in DB to avoid duplicates)

// 5. Test with development SMTP (Mailtrap.io or similar)
```

### Alternative: Gmail SMTP (Development Only)

For local development and testing, Gmail SMTP can be used:
- Free and easy setup
- 500 emails/day limit
- Requires "App Password" (not suitable for production)
- Good for testing without creating SendGrid account initially

**Switch to SendGrid before beta deployment.**

## Next Steps

1. **Approval Required:** Confirm approach with user
2. **Create ADR:** Document decision in `docs/adr/0004-email-notifications.md`
3. **Implementation Tasks:**
   - Add environment variables to `.env.example`
   - Create `backend/src/services/email.ts`
   - Create `backend/src/services/scheduler.ts`
   - Add tests for email service (mock SMTP)
   - Update README with email configuration instructions
   - Document SendGrid setup steps

## References

- [Nodemailer Documentation](https://nodemailer.com/)
- [node-cron Documentation](https://nodecron.com/)
- [SendGrid Free Tier Details](https://sendgrid.com/pricing/)
- [Azure SMTP Restrictions](https://docs.microsoft.com/en-us/azure/virtual-network/troubleshoot-outbound-smtp-connectivity)
- [Azure Communication Services Email](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-overview)
- [Transactional Email Services Comparison (2026)](https://mailtrap.io/blog/transactional-email-services/)
