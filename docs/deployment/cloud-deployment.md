# Cloud Deployment Guide (Azure)

This guide covers deploying GeneratorLog to Microsoft Azure using the free tier for beta testing and cost-effective production deployment options.

---

## Overview

**Deployment Architecture**:
- **Frontend**: Azure App Service (`generatorlog.azurewebsites.net`) — serves the React/Vite SPA using `serve` (npm)
- **Backend API**: Azure App Service (`generatorlog-api.azurewebsites.net`) — runs the Node.js/Fastify API
- **Database**: Neon PostgreSQL (free tier) or Azure Database for PostgreSQL
- **Secrets**: Azure Key Vault — all secrets stored here, referenced via Managed Identity

**Why two App Services?** The frontend (React/Vite) is a static build and the backend is a Node.js API. Separating them lets each be deployed and scaled independently. Both live under `*.azurewebsites.net` with clean, predictable URLs.

**Cross-origin cookies**: Because frontend and backend are on different subdomains, session cookies are set with `SameSite=None; Secure` in production. This is enforced in `backend/src/services/session.ts` and requires HTTPS on both sides (Azure provides this automatically).

**Cost Estimates**:
- **Beta (3-10 users)**: $0/month (both on App Service F1 + Neon PostgreSQL Free) — F1 plan supports multiple apps
- **Production (10-100 users)**: $9-30/month depending on tier

---

## Prerequisites

1. **Azure Account**: Create at [portal.azure.com](https://portal.azure.com)
2. **Azure CLI**: Install from [docs.microsoft.com/cli/azure/install-azure-cli](https://docs.microsoft.com/cli/azure/install-azure-cli)
3. **Node.js + pnpm**: Node.js 22+ and pnpm for building the project locally before deployment
4. **Neon Account** (optional): Create at [neon.tech](https://neon.tech) for free PostgreSQL database

---

## Publishing Sequence (Quick Reference)

Condensed checklist for routine re-deploys once infrastructure exists. Full details: backend in
[Step 4](#step-4-deploy-backend-to-generatorlog-api), frontend in [Step 5](#step-5-deploy-frontend-to-generatorlog).

**Backend** (`generatorlog-api`):
1. `CI=true pnpm install` (repo root)
2. Build: `backend/node_modules/.bin/tsc -p backend/tsconfig.json` → `backend/dist/`
3. Stage flat deps: copy `backend/package.json` + `backend/dist/` to a clean staging dir, add `.npmrc` with `node-linker=hoisted`, run `CI=true pnpm install --prod --dir <staging>` (pnpm symlinks break on Azure otherwise)
4. Zip `dist/ node_modules/ package.json` (exclude `*.map`)
5. `az webapp deploy --resource-group generatorlog-rg --name generatorlog-api --src-path <zip> --type zip`
6. Verify: `curl https://generatorlog-api.azurewebsites.net/health` → `{"status":"ok",...}`

**Frontend** (`generatorlog`):
1. Build with the backend URL baked in: `VITE_API_URL=https://generatorlog-api.azurewebsites.net pnpm --dir frontend run build`
2. Stage `dist/` + minimal `package.json` (with `serve` dependency) + hoisted install
3. Zip `dist/ node_modules/ package.json`
4. `az webapp deploy --resource-group generatorlog-rg --name generatorlog --src-path <zip> --type zip`
5. Verify: `https://generatorlog.azurewebsites.net/` returns 200 and shows the login page

**Notes**:
- Deploy backend before frontend when an API change is involved.
- F1 tier has no Always-On: the first request after idle cold-starts (~10–30 s) — a slow first `curl` is normal.
- No CI/CD pipeline exists yet (`.github/workflows/` is empty); this manual sequence is the publishing process. Automating it via GitHub Actions is documented future work.

---

## Option 1: Beta Deployment (Free Tier) - $0/month

### Step 1: Create Neon PostgreSQL Database (Free)

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up or log in
3. Click "Create Project"
4. Configure:
   - **Project name**: generatorlog
   - **Region**: Choose closest to your users (e.g., US East, EU West)
   - **PostgreSQL version**: 16 (latest)
5. Click "Create Project"
6. Copy the connection string (looks like `postgresql://user:password@host/dbname`)

**Connection String Format**:
```
postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

### Step 2: Create Azure Infrastructure

#### Login to Azure
```bash
az login
```

#### Create Resource Group
```bash
az group create --name generatorlog-rg --location centralus
```

#### Create App Service Plan (Free tier, shared by both apps)
```bash
az appservice plan create \
  --name generatorlog-plan \
  --resource-group generatorlog-rg \
  --sku F1 \
  --is-linux \
  --location centralus
```

**Note**: F1 quota varies by region. If you get a quota error, try `centralus` (confirmed working) instead of `eastus`.

#### Create Backend App Service
```bash
az webapp create \
  --name generatorlog-api \
  --resource-group generatorlog-rg \
  --plan generatorlog-plan \
  --runtime "NODE:22-lts"
```

#### Create Frontend App Service
```bash
az webapp create \
  --name generatorlog \
  --resource-group generatorlog-rg \
  --plan generatorlog-plan \
  --runtime "NODE:22-lts"
```

**Note**: App names must be globally unique. If taken, try `generatorlog-api-yourname` / `generatorlog-yourname` or similar. The frontend serves at `https://generatorlog.azurewebsites.net` and the backend at `https://generatorlog-api.azurewebsites.net`.

---

### Step 3: Set Up Azure Key Vault

All secrets are stored in Azure Key Vault and referenced via Managed Identity — secrets never appear as plaintext in app settings.

#### Create Key Vault
```bash
az keyvault create \
  --name generatorlog-kv \
  --resource-group generatorlog-rg \
  --location centralus \
  --enable-rbac-authorization true
```

#### Grant Yourself Secrets Access (Required Before Storing Secrets)
```bash
MY_OID=$(az ad signed-in-user show --query id -o tsv)

KV_ID=$(az keyvault show \
  --name generatorlog-kv \
  --resource-group generatorlog-rg \
  --query id -o tsv)

az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee $MY_OID \
  --scope $KV_ID
```

#### Store Secrets
```bash
# Assign connection string to a variable to avoid it appearing in shell history
DB_URL='postgresql://user:pass@host/db?sslmode=require'
az keyvault secret set \
  --vault-name generatorlog-kv \
  --name DatabaseURL \
  --value "$DB_URL"

az keyvault secret set \
  --vault-name generatorlog-kv \
  --name SessionSecret \
  --value "$(openssl rand -base64 48)"

# SMTP credentials (add these after you have Brevo/SMTP configured)
az keyvault secret set --vault-name generatorlog-kv --name SmtpUser --value "your-smtp-login"
az keyvault secret set --vault-name generatorlog-kv --name SmtpPassword --value "your-smtp-api-key"
```

---

### Step 4: Deploy Backend to `generatorlog-api`

#### Configure Non-Secret Environment Variables
```bash
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --settings \
    NODE_ENV="production" \
    API_RATE_LIMIT="1" \
    CORS_ORIGIN="https://generatorlog.azurewebsites.net" \
    SMTP_HOST="smtp.brevo.com" \
    SMTP_PORT="587" \
    SMTP_FROM="GeneratorLog <noreply@generatorlog.com>" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

#### Enable Managed Identity and Grant Key Vault Access
```bash
az webapp identity assign \
  --name generatorlog-api \
  --resource-group generatorlog-rg

PRINCIPAL_ID=$(az webapp identity show \
  --name generatorlog-api \
  --resource-group generatorlog-rg \
  --query principalId -o tsv)

KV_ID=$(az keyvault show \
  --name generatorlog-kv \
  --resource-group generatorlog-rg \
  --query id -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $PRINCIPAL_ID \
  --scope $KV_ID
```

#### Reference Secrets from Key Vault
```bash
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/DatabaseURL/)" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SessionSecret/)" \
    SMTP_USER="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SmtpUser/)" \
    SMTP_PASSWORD="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SmtpPassword/)"
```

#### Set Startup Command
```bash
az webapp config set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --startup-file "node dist/index.js"
```

#### Build and Deploy Backend Code (Zip Deploy)

App Service runs Node.js directly (not Docker). The backend must be built locally and deployed as a zip. pnpm uses symlinks internally — if you zip `node_modules` directly they break on Azure. The fix is to install into a clean staging directory with `node-linker=hoisted`:

```bash
# From the repo root

# 1. Install all deps (needed for tsc)
CI=true pnpm install

# 2. Build TypeScript
backend/node_modules/.bin/tsc -p backend/tsconfig.json
# Or: pnpm --dir backend run build  (if tsc is in PATH)

# 3. Create staging dir with flat node_modules (no pnpm symlinks)
rm -rf /tmp/generatorlog-staging
mkdir /tmp/generatorlog-staging
cp backend/package.json /tmp/generatorlog-staging/
cp -r backend/dist /tmp/generatorlog-staging/
echo "node-linker=hoisted" > /tmp/generatorlog-staging/.npmrc
CI=true pnpm install --prod --dir /tmp/generatorlog-staging

# 4. Zip (exclude source maps to reduce size)
cd /tmp/generatorlog-staging
zip -r /tmp/generatorlog-deploy.zip dist/ node_modules/ package.json -x "*.map"
cd -

# 5. Deploy
az webapp deploy \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --src-path /tmp/generatorlog-deploy.zip \
  --type zip
```

#### Verify Backend Deployment

```bash
curl https://generatorlog-api.azurewebsites.net/health
# Expected: {"status":"ok","timestamp":"...","environment":"production"}
```

**Check logs**:
```bash
az webapp log tail \
  --name generatorlog-api \
  --resource-group generatorlog-rg
```

---

### Step 5: Deploy Frontend to `generatorlog`

The frontend is a React/Vite SPA deployed as static files served via the `serve` npm package on App Service.

#### Configure and Set Startup Command
```bash
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false

az webapp config set \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --startup-file "node_modules/.bin/serve -s dist"
```

#### Build the Frontend

The frontend must be built with the backend URL injected at build time:

```bash
VITE_API_URL=https://generatorlog-api.azurewebsites.net \
  pnpm --dir frontend run build
# Output: frontend/dist/
```

`VITE_API_URL` is consumed in `frontend/src/utils/api.ts` as `import.meta.env.VITE_API_URL`. If your App Service names differ, replace the URL above.

#### Package and Deploy Frontend

```bash
# 1. Create staging directory
rm -rf /tmp/generatorlog-frontend-staging
mkdir /tmp/generatorlog-frontend-staging
cp -r frontend/dist /tmp/generatorlog-frontend-staging/

# 2. Create minimal package.json with serve dependency
cat > /tmp/generatorlog-frontend-staging/package.json << 'EOF'
{
  "name": "generatorlog-frontend",
  "version": "1.0.0",
  "scripts": {
    "start": "serve -s dist"
  },
  "dependencies": {
    "serve": "^14.2.4"
  }
}
EOF

# 3. Install serve with flat node_modules
cd /tmp/generatorlog-frontend-staging
echo "node-linker=hoisted" > .npmrc
CI=true pnpm install --prod
cd -

# 4. Zip and deploy
cd /tmp/generatorlog-frontend-staging
zip -r /tmp/generatorlog-frontend-deploy.zip dist/ node_modules/ package.json
cd -

az webapp deploy \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --src-path /tmp/generatorlog-frontend-deploy.zip \
  --type zip
```

**SPA routing**: The `serve -s` flag serves `index.html` for all unmatched routes — required for React Router's `BrowserRouter`.

#### Verify Frontend

```bash
curl -s -o /dev/null -w "%{http_code}" https://generatorlog.azurewebsites.net/
# Expected: 200
```

Visit `https://generatorlog.azurewebsites.net` in your browser — you should see the GeneratorLog login page.

---

## Option 2: Production Deployment (Container) - $9-30/month

### Step 1: Choose Database

**Option A: Neon PostgreSQL Free Tier** ($0/month)
- Follow Step 1 from "Beta Deployment" above
- Suitable for 10-100 users
- 0.5GB storage limit

**Option B: Azure Database for PostgreSQL** ($17/month)
- Always-on, no cold starts
- Automated backups
- Azure-native integration

#### Create Azure PostgreSQL (Option B)
```bash
az postgres flexible-server create \
  --name generatorlog-db \
  --resource-group generatorlog-rg \
  --location centralus\
  --admin-user generatorlog \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16

# Allow Azure services to access database
az postgres flexible-server firewall-rule create \
  --resource-group generatorlog-rg \
  --name generatorlog-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Get connection string
az postgres flexible-server show-connection-string \
  --name generatorlog-db \
  --admin-user generatorlog \
  --database-name generatorlog
```

### Step 2: Push Docker Image to Azure Container Registry

#### Create Azure Container Registry
```bash
az acr create \
  --resource-group generatorlog-rg \
  --name generatorlogcr \
  --sku Basic \
  --admin-enabled true
```

#### Build and Push Image
```bash
# Login to ACR
az acr login --name generatorlogcr

# Build image
docker build -t generatorlog:latest ./backend

# Tag for ACR
docker tag generatorlog:latest generatorlogcr.azurecr.io/generatorlog:latest

# Push to ACR
docker push generatorlogcr.azurecr.io/generatorlog:latest
```

### Step 3: Deploy Container to App Service

#### Create App Service for Containers
```bash
az appservice plan create \
  --name generatorlog-plan \
  --resource-group generatorlog-rg \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group generatorlog-rg \
  --plan generatorlog-plan \
  --name generatorlog-api \
  --deployment-container-image-name generatorlogcr.azurecr.io/generatorlog:latest

# Enable managed identity (required for ACR pull and Key Vault access)
az webapp identity assign \
  --name generatorlog-api \
  --resource-group generatorlog-rg

PRINCIPAL_ID=$(az webapp identity show \
  --name generatorlog-api \
  --resource-group generatorlog-rg \
  --query principalId -o tsv)

# Grant AcrPull role — no admin credentials needed
ACR_ID=$(az acr show --name generatorlogcr --resource-group generatorlog-rg --query id -o tsv)
az role assignment create \
  --role AcrPull \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID

# Disable ACR admin account (admin credentials are not used)
az acr update --name generatorlogcr --admin-enabled false

# Configure container using managed identity for ACR (no password)
az webapp config container set \
  --name generatorlog-api \
  --resource-group generatorlog-rg \
  --docker-custom-image-name generatorlogcr.azurecr.io/generatorlog:latest \
  --docker-registry-server-url https://generatorlogcr.azurecr.io

# Enable managed identity for ACR pull
az resource update \
  --ids /subscriptions/$(az account show --query id -o tsv)/resourceGroups/generatorlog-rg/providers/Microsoft.Web/sites/generatorlog-api/config/web \
  --set properties.acrUseManagedIdentityCreds=true

# Set non-secret environment variables
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --settings \
    NODE_ENV="production" \
    API_RATE_LIMIT="1" \
    CORS_ORIGIN="https://generatorlog.azurewebsites.net" \
    SMTP_HOST="smtp.brevo.com" \
    SMTP_PORT="587" \
    SMTP_FROM="GeneratorLog <noreply@generatorlog.com>"

# Reference all secrets from Key Vault (see Key Vault setup above)
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/DatabaseURL/)" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SessionSecret/)" \
    SMTP_USER="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SmtpUser/)" \
    SMTP_PASSWORD="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SmtpPassword/)" \
    OAUTH_CLIENT_ID="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/OauthClientId/)" \
    OAUTH_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/OauthClientSecret/)"
```

#### Restart App
```bash
az webapp restart \
  --name generatorlog-api \
  --resource-group generatorlog-rg
```

---

## Configuration

### Environment Variables

All environment variables should be set using Azure App Service configuration or Container environment variables:

| Variable | App | Required | Description | Example |
|----------|-----|----------|-------------|---------|
| `DATABASE_URL` | Backend | ✅ | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `NODE_ENV` | Backend | ✅ | Environment | `production` |
| `API_RATE_LIMIT` | Backend | ✅ | Rate limit (req/sec) | `1` |
| `SESSION_SECRET` | Backend | ✅ | Session secret key | Random 32+ char string |
| `CORS_ORIGIN` | Backend | ✅ | Frontend URL for CORS | `https://generatorlog.azurewebsites.net` |
| `PORT` | Both | ❌ | App port (auto-set by Azure) | `3000` |
| `SMTP_HOST` | Backend | ⚠️ | Email server (for reminders) | `smtp.brevo.com` |
| `SMTP_USER` | Backend | ⚠️ | Email user | `app@example.com` |
| `SMTP_PASSWORD` | Backend | ⚠️ | Email password | API key |
| `OAUTH_CLIENT_ID` | Backend | ⚠️ | OAuth client ID | Google client ID |
| `OAUTH_CLIENT_SECRET` | Backend | ⚠️ | OAuth client secret | |

### Secret Rotation

To rotate a secret, set a new version in Key Vault. The app picks it up on the next restart (or within ~4 hours):
```bash
az keyvault secret set \
  --vault-name generatorlog-kv \
  --name SessionSecret \
  --value "$(openssl rand -base64 48)"

az webapp restart --name generatorlog-api --resource-group generatorlog-rg
```

---

## MCP Endpoint + OAuth Configuration (WorkOS AuthKit)

The `/mcp` endpoint ([ADR 0004](../adr/0004-mcp-server-alongside-rest-api.md)) authenticates AI
agents exclusively via OAuth 2.1 through WorkOS AuthKit ([ADR 0005](../adr/0005-mcp-oauth-only-workos-authkit.md)).
The `gl_` API key is used only by iOS Shortcuts on the REST endpoint. Perform this setup once,
before deploying the MCP-enabled backend.

### WorkOS Dashboard Setup

1. Create a free WorkOS account at [workos.com](https://workos.com) (AuthKit is free up to 1M monthly active users)
2. In the dashboard, enable **AuthKit** and note the issuer URL (`https://<tenant>.authkit.app`)
3. Under AuthKit → Connected apps / MCP settings:
   - Enable **Client ID Metadata Documents (CIMD)** — preferred registration method for Claude
   - Enable **Dynamic Client Registration (DCR)** for backward compatibility with older MCP clients
   - Register the resource indicator: `https://generatorlog-api.azurewebsites.net/mcp`
4. Create your user account in AuthKit (email + password or social login) — this is the identity agents act as

### App Service Settings

These values are identifiers, **not secrets** — set them as plain app settings (no Key Vault reference needed):

```bash
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --settings \
    AUTHKIT_ISSUER=https://<tenant>.authkit.app \
    MCP_RESOURCE_URL=https://generatorlog-api.azurewebsites.net/mcp
```

Per the CLAUDE.md secrets rules: never set actual secrets as plain app settings; AuthKit
integration requires none (JWT verification uses the public JWKS endpoint).

### Connecting Claude Surfaces (one-time interactive sign-in each)

| Surface | How |
|---------|-----|
| claude.ai / Claude mobile | Settings → Connectors → Add custom connector → `https://generatorlog-api.azurewebsites.net/mcp` → complete AuthKit sign-in |
| Claude Code | `claude mcp add --transport http generatorlog https://generatorlog-api.azurewebsites.net/mcp`, then `/mcp` → authenticate on first 401 |
| Cloud Routine | Grant the already-authenticated `generatorlog` MCP server when creating the Routine ([ADR 0006](../adr/0006-scheduled-monitoring-claude-routine.md)) |

**Token refresh**: Claude refreshes OAuth tokens automatically (including for headless Routines).
If a refresh ever fails, re-authenticate once interactively on any surface.

---

## Database Migrations

### Run Migrations with Drizzle Kit

```bash
# Locally, with DATABASE_URL pointing to cloud database
npx drizzle-kit push:pg

# Or via Azure CLI command execution
az webapp ssh --name generatorlog-api --resource-group generatorlog-rg
# Then inside container:
cd /app
npm run db:migrate
```

---

## Monitoring and Logs

### View Application Logs
```bash
# Tail logs in real-time
az webapp log tail \
  --name generatorlog-api \
  --resource-group generatorlog-rg

# Download logs
az webapp log download \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --log-file logs.zip
```

### Enable Application Insights (Optional)
```bash
az monitor app-insights component create \
  --app generatorlog-insights \
  --location centralus\
  --resource-group generatorlog-rg

INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app generatorlog-insights \
  --resource-group generatorlog-rg \
  --query instrumentationKey -o tsv)

az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog-api \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

---

## Scaling

### Manual Scaling
```bash
# Scale App Service plan
az appservice plan update \
  --name generatorlog-plan \
  --resource-group generatorlog-rg \
  --sku B2  # 2 vCPU, 3.5GB RAM
```

### Auto-scaling (Premium tiers only)
See Azure documentation for auto-scale rules.

---

## Cost Optimization Tips

1. **Use Free Tier for Beta**: F1 App Service (single plan, two apps) + Neon free tier = $0/month
2. **Start Small**: B1 App Service is sufficient for 10-100 users
3. **Monitor Database Usage**: Neon free tier has 0.5GB limit
4. **Use Managed Identity**: Avoids Key Vault costs for simple deployments
5. **Regional Choices**: Some regions are cheaper (e.g., East US vs West Europe)

---

## Troubleshooting

### App Won't Start
1. Check logs: `az webapp log tail --name generatorlog-api --resource-group generatorlog-rg`
2. Verify environment variables are set correctly
3. Ensure DATABASE_URL is accessible from Azure
4. Check Node.js version — Azure App Service offers `NODE:20-lts`, `NODE:22-lts`, `NODE:24-lts` (not 25/26)

### Backend Deploy: Module Not Found / App Crashes Immediately
**Cause**: pnpm `node_modules` uses symlinks that break when zipped. Deploy shows "Site started successfully" but app crashes.

**Fix**: Use the staging directory approach in the deploy steps above — `node-linker=hoisted` forces a flat `node_modules` compatible with zip deployment.

### Database Connection Errors
1. Verify connection string format
2. Check firewall rules (allow Azure services)
3. For Neon: Ensure SSL mode is set (`?sslmode=require`)
4. Neon connection strings often contain `&` characters — always assign to a shell variable before passing to avoid shell parsing issues:
   ```bash
   DB_URL='postgresql://user:pass@host/db?sslmode=require&channel_binding=require'
   az keyvault secret set --vault-name generatorlog-kv --name DatabaseURL --value "$DB_URL"
   ```

### Frontend Login Fails / 401 from API
**Cause**: Cross-origin cookies not being sent.

Check:
1. `CORS_ORIGIN` on `generatorlog-api` matches the frontend URL exactly (including `https://`, no trailing slash)
2. Backend is deployed with the `SameSite=None` cookie fix (in `backend/src/services/session.ts`)
3. Both URLs are HTTPS — `SameSite=None` requires Secure context

### Frontend 404 on Page Refresh
**Cause**: The `serve` static server needs to be started with the `-s` (SPA mode) flag so it serves `index.html` for unmatched routes.

**Fix**: Startup command must be `node_modules/.bin/serve -s dist` (note the `-s` flag).

### F1 Quota Error on App Service Plan
Azure limits F1 (free) plan instances per region. If you see "Current Limit (Free VMs): 0", try a different region:
```bash
az appservice plan create ... --location centralus  # confirmed working
```

### Cold Starts (F1 Tier)
- Expected behavior: App sleeps after 20 min inactivity
- Mitigation: Upgrade to B1 tier or use external ping service
- For beta testing: Acceptable trade-off

### Key Vault Reference Not Resolving
If app settings show `@Microsoft.KeyVault(...)` literally instead of the secret value:
1. Verify Managed Identity is assigned: `az webapp identity show --name generatorlog-api --resource-group generatorlog-rg`
2. Verify the `Key Vault Secrets User` role is assigned to the identity on the vault
3. Restart the app: `az webapp restart --name generatorlog-api --resource-group generatorlog-rg`

---

## Security Checklist

- ✅ Use HTTPS (automatic on Azure App Service)
- ✅ Store secrets in Azure Key Vault, referenced via Managed Identity
- ✅ Session cookies use `SameSite=None; Secure` in production (cross-origin safe)
- ✅ Enable SSL for database connections (`sslmode=require`)
- ✅ `CORS_ORIGIN` set to exact frontend URL (no wildcard)
- ✅ Use managed identity for Key Vault — no credentials in app settings
- ✅ Rotate `SessionSecret` and API keys regularly via Key Vault secret rotation
- ✅ Set up monitoring and alerts

---

## Next Steps

1. Configure email (SMTP) for maintenance reminders — add SmtpUser/SmtpPassword to Key Vault
2. Set up OAuth2 for web interface authentication
3. Configure custom domain and SSL certificate
4. Set up CI/CD pipeline with GitHub Actions
5. Implement monitoring and alerting

---

## References

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for PostgreSQL](https://docs.microsoft.com/azure/postgresql/)
- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [ADR 0002: Database Choice](../adr/0002-postgresql-database-choice.md)
- [Local Deployment Guide](./local-deployment.md)
