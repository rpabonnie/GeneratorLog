# Cloud Deployment Guide (Azure)

This guide covers deploying GeneratorLog to Microsoft Azure using the free tier for beta testing and cost-effective production deployment options.

---

## Overview

**Deployment Architecture**:
- **Backend**: Azure App Service (Node.js container or direct code deployment)
- **Database**: Neon PostgreSQL (free tier) or Azure Database for PostgreSQL
- **Storage**: No additional storage needed (database handles everything)

**Cost Estimates**:
- **Beta (3-10 users)**: $0/month (App Service F1 Free + Neon PostgreSQL Free)
- **Production (10-100 users)**: $9-30/month depending on tier

---

## Prerequisites

1. **Azure Account**: Create at [portal.azure.com](https://portal.azure.com)
2. **Azure CLI**: Install from [docs.microsoft.com/cli/azure/install-azure-cli](https://docs.microsoft.com/cli/azure/install-azure-cli)
3. **Neon Account** (optional): Create at [neon.tech](https://neon.tech) for free PostgreSQL database
4. **Git**: For deployment from repository

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

### Step 2: Deploy to Azure App Service F1 (Free)

#### Login to Azure
```bash
az login
```

#### Create Resource Group
```bash
az group create --name generatorlog-rg --location eastus
```

#### Create App Service Plan (Free tier)
```bash
az appservice plan create \
  --name generatorlog-plan \
  --resource-group generatorlog-rg \
  --sku F1 \
  --is-linux
```

#### Create Web App for Node.js
```bash
az webapp create \
  --name generatorlog \
  --resource-group generatorlog-rg \
  --plan generatorlog-plan \
  --runtime "NODE:25.2"
```

**Note**: The app name (`generatorlog`) must be globally unique. If taken, try `generatorlog-yourname` or similar.

#### Configure Environment Variables
```bash
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --settings \
    DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require" \
    NODE_ENV="production" \
    API_RATE_LIMIT="1" \
    SESSION_SECRET="$(openssl rand -base64 32)"
```

Replace the `DATABASE_URL` with your Neon connection string from Step 1.

#### Deploy Code

**Option A: Deploy from Local Git**

1. Navigate to your project directory
2. Initialize Git repository (if not already done)
```bash
git init
git add .
git commit -m "Initial commit"
```

3. Add Azure remote and deploy
```bash
az webapp deployment source config-local-git \
  --name generatorlog \
  --resource-group generatorlog-rg

# Get the Git URL
GIT_URL=$(az webapp deployment list-publishing-credentials \
  --name generatorlog \
  --resource-group generatorlog-rg \
  --query scmUri -o tsv)

git remote add azure $GIT_URL
git push azure main
```

**Option B: Deploy from GitHub**

1. Push your code to GitHub
2. Configure continuous deployment:
```bash
az webapp deployment source config \
  --name generatorlog \
  --resource-group generatorlog-rg \
  --repo-url https://github.com/yourusername/GeneratorLog \
  --branch main \
  --manual-integration
```

#### Verify Deployment

Visit your app at: `https://generatorlog.azurewebsites.net`

**Check logs**:
```bash
az webapp log tail \
  --name generatorlog \
  --resource-group generatorlog-rg
```

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
  --location eastus \
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
  --name generatorlog \
  --deployment-container-image-name generatorlogcr.azurecr.io/generatorlog:latest

# Configure ACR credentials
az webapp config container set \
  --name generatorlog \
  --resource-group generatorlog-rg \
  --docker-custom-image-name generatorlogcr.azurecr.io/generatorlog:latest \
  --docker-registry-server-url https://generatorlogcr.azurecr.io \
  --docker-registry-server-user generatorlogcr \
  --docker-registry-server-password $(az acr credential show --name generatorlogcr --query passwords[0].value -o tsv)

# Set environment variables
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --settings \
    DATABASE_URL="your-postgres-connection-string" \
    NODE_ENV="production" \
    API_RATE_LIMIT="1" \
    SESSION_SECRET="$(openssl rand -base64 32)"
```

#### Restart App
```bash
az webapp restart \
  --name generatorlog \
  --resource-group generatorlog-rg
```

---

## Alternative: Azure Container Instances (ACI)

For simpler container deployment without App Service overhead:

### Deploy to ACI
```bash
az container create \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --image generatorlogcr.azurecr.io/generatorlog:latest \
  --registry-login-server generatorlogcr.azurecr.io \
  --registry-username generatorlogcr \
  --registry-password $(az acr credential show --name generatorlogcr --query passwords[0].value -o tsv) \
  --cpu 0.5 \
  --memory 1 \
  --ports 3000 \
  --dns-name-label generatorlog-api \
  --environment-variables \
    DATABASE_URL="your-postgres-connection-string" \
    NODE_ENV="production" \
    API_RATE_LIMIT="1" \
    SESSION_SECRET="random-secret-here"
```

**Cost**: ~$9/month (0.5 vCPU, 1GB RAM)

Access at: `http://generatorlog-api.<region>.azurecontainer.io:3000`

---

## Configuration

### Environment Variables

All environment variables should be set using Azure App Service configuration or Container environment variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `NODE_ENV` | ✅ | Environment | `production` |
| `API_RATE_LIMIT` | ✅ | Rate limit (req/sec) | `1` |
| `SESSION_SECRET` | ✅ | Session secret key | Random 32+ char string |
| `PORT` | ❌ | App port (auto-set by Azure) | `3000` |
| `SMTP_HOST` | ⚠️ | Email server (for reminders) | `smtp.gmail.com` |
| `SMTP_USER` | ⚠️ | Email user | `app@example.com` |
| `SMTP_PASSWORD` | ⚠️ | Email password | App password |
| `OAUTH_CLIENT_ID` | ⚠️ | OAuth client ID | Google client ID |
| `OAUTH_CLIENT_SECRET` | ⚠️ | OAuth client secret | |

### Setting Secrets in Azure Key Vault (Recommended for Production)

```bash
# Create Key Vault
az keyvault create \
  --name generatorlog-kv \
  --resource-group generatorlog-rg \
  --location eastus

# Store secrets
az keyvault secret set \
  --vault-name generatorlog-kv \
  --name DatabaseURL \
  --value "postgresql://user:pass@host/db"

az keyvault secret set \
  --vault-name generatorlog-kv \
  --name SessionSecret \
  --value "$(openssl rand -base64 32)"

# Grant App Service access to Key Vault
# Enable managed identity first
az webapp identity assign \
  --name generatorlog \
  --resource-group generatorlog-rg

PRINCIPAL_ID=$(az webapp identity show \
  --name generatorlog \
  --resource-group generatorlog-rg \
  --query principalId -o tsv)

az keyvault set-policy \
  --name generatorlog-kv \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# Reference secrets in app settings
az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/DatabaseURL/)" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=https://generatorlog-kv.vault.azure.net/secrets/SessionSecret/)"
```

---

## Database Migrations

### Run Migrations with Drizzle Kit

```bash
# Locally, with DATABASE_URL pointing to cloud database
npx drizzle-kit push:pg

# Or via Azure CLI command execution
az webapp ssh --name generatorlog --resource-group generatorlog-rg
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
  --name generatorlog \
  --resource-group generatorlog-rg

# Download logs
az webapp log download \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --log-file logs.zip
```

### Enable Application Insights (Optional)
```bash
az monitor app-insights component create \
  --app generatorlog-insights \
  --location eastus \
  --resource-group generatorlog-rg

INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app generatorlog-insights \
  --resource-group generatorlog-rg \
  --query instrumentationKey -o tsv)

az webapp config appsettings set \
  --resource-group generatorlog-rg \
  --name generatorlog \
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

# Scale Container Instances
az container update \
  --resource-group generatorlog-rg \
  --name generatorlog \
  --cpu 1 \
  --memory 2
```

### Auto-scaling (Premium tiers only)
See Azure documentation for auto-scale rules.

---

## Cost Optimization Tips

1. **Use Free Tier for Beta**: F1 App Service + Neon free tier = $0/month
2. **Start Small**: B1 App Service is sufficient for 10-100 users
3. **Monitor Database Usage**: Neon free tier has 0.5GB limit
4. **Use Managed Identity**: Avoid Key Vault costs for simple deployments
5. **Regional Choices**: Some regions are cheaper (e.g., East US vs West Europe)

---

## Troubleshooting

### App Won't Start
1. Check logs: `az webapp log tail --name generatorlog --resource-group generatorlog-rg`
2. Verify environment variables are set correctly
3. Ensure DATABASE_URL is accessible from Azure
4. Check Node.js version matches (25.2.1)

### Database Connection Errors
1. Verify connection string format
2. Check firewall rules (allow Azure services)
3. For Neon: Ensure SSL mode is set (`?sslmode=require`)
4. Test connection locally first

### Cold Starts (F1 Tier)
- Expected behavior: App sleeps after 20 min inactivity
- Mitigation: Upgrade to B1 tier or use external ping service
- For beta testing: Acceptable trade-off

---

## Security Checklist

- ✅ Use HTTPS (automatic with Azure App Service)
- ✅ Store secrets in Azure Key Vault or environment variables
- ✅ Enable SSL for database connections (`sslmode=require`)
- ✅ Configure firewall rules (database, App Service)
- ✅ Use managed identity for authentication where possible
- ✅ Rotate SESSION_SECRET and API keys regularly
- ✅ Enable Azure AD authentication for admin access
- ✅ Set up monitoring and alerts

---

## Next Steps

1. Configure email (SMTP) for maintenance reminders
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
