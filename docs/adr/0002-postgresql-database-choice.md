# ADR 0002: PostgreSQL for Cloud Deployment with Multi-User Support

**Date**: 2026-02-11
**Status**: Accepted
**Deciders**: Ray Pabonnie, Claude Code
**Context**: Database selection for GeneratorLog cloud deployment on Azure

---

## Context and Problem Statement

GeneratorLog requires a database solution that:
- Supports multi-user concurrent access (beta: 3 users, production: 10-100 users)
- Works reliably on Azure cloud infrastructure
- Minimizes operational costs
- Survives container restarts and redeployments
- Aligns with minimal dependencies philosophy
- Supports both cloud and local deployment scenarios

Initial research explored SQLite as an embedded database option, but cloud deployment requirements revealed critical limitations for multi-user scenarios.

---

## Decision Drivers

1. **Multi-user concurrent access** - Multiple users making API calls simultaneously
2. **Cloud deployment reliability** - Database must work reliably in Azure container environments
3. **Cost optimization** - Minimize infrastructure costs, especially during beta phase
4. **Data persistence** - Database must survive container restarts
5. **Deployment flexibility** - Support cloud (Azure) and local (self-hosted) deployments
6. **Minimal complexity** - Avoid unnecessary infrastructure overhead
7. **Open source considerations** - Users should be able to self-host easily

---

## Considered Options

### Option 1: SQLite with Azure Files (SMB mount)
**Cost**: ~$10/month (containers + Azure Files)

**Pros**:
- Lowest infrastructure cost
- Simple architecture (single container)
- No external database service
- Minimal dependencies (aligns with CLAUDE.md philosophy)

**Cons**:
- ❌ **File locking unreliable over SMB network filesystem**
- ❌ **Database corruption risk with concurrent writes**
- ❌ **100-500ms latency vs <1ms local disk**
- ❌ **SQLite developers explicitly warn against network filesystems**
- ❌ **Cannot scale horizontally (single-writer limitation)**
- ❌ **Poor multi-user concurrent access performance**

**Verdict**: Rejected - Too risky for production multi-user deployment

---

### Option 2: Self-hosted PostgreSQL Container
**Cost**: ~$64/month (multi-container group + managed disk)

**Pros**:
- Full control over PostgreSQL configuration
- No external service dependencies
- Standard PostgreSQL (no vendor lock-in)

**Cons**:
- ❌ **3.7x more expensive than managed PostgreSQL** ($64 vs $17)
- ❌ Manual backup management
- ❌ Manual security updates and patches
- ❌ No automatic high availability
- ❌ Complex networking setup
- ❌ Not cost-effective

**Verdict**: Rejected - Poor cost-to-benefit ratio

---

### Option 3: Azure Database for PostgreSQL Flexible Server (B1ms)
**Cost**: ~$17/month (database only)

**Pros**:
- ✅ Professional-grade managed service
- ✅ Automated backups (7-35 day retention)
- ✅ Automatic security patches
- ✅ Built-in monitoring and alerts
- ✅ Excellent multi-user concurrent access
- ✅ 73% cheaper than self-hosted option
- ✅ Virtual network integration
- ✅ High availability option available
- ✅ Standard PostgreSQL (no vendor lock-in)

**Cons**:
- Ongoing cost (no free tier)
- Compute cost even when idle (minimized with burstable tier)

**Verdict**: Excellent for production, but costly for beta testing

---

### Option 4: Neon PostgreSQL (Serverless, Free Tier)
**Cost**: $0/month (free tier)

**Pros**:
- ✅ **FREE TIER: 0.5GB storage** (sufficient for years of generator logs)
- ✅ **True PostgreSQL** (full compatibility, standard tooling)
- ✅ **Autoscaling compute** (scale-to-zero when idle)
- ✅ **Automatic backups** included
- ✅ **Perfect for low-traffic apps** like home automation
- ✅ **Standard PostgreSQL drivers** (pg, Drizzle ORM)
- ✅ **Database branching** for dev/test environments
- ✅ **Easy upgrade path** to paid tier if needed

**Cons**:
- ⚠️ 0.5GB storage limit (need to monitor growth)
- ⚠️ Cold starts after 5 min inactivity (5-10 sec delay)
- ⚠️ External dependency (not Azure-native)
- ⚠️ Vendor lock-in (though standard PostgreSQL)

**Verdict**: SELECTED for beta and initial production

---

## Decision Outcome

**Chosen option**: **PostgreSQL with phased deployment strategy**

### Phase 1: Beta Testing (3 users)
**Database**: Neon PostgreSQL (Free tier)
**Compute**: Azure App Service F1 (Free tier)
**Total Cost**: **$0/month**

**Rationale**:
- Zero cost perfect for beta testing
- 0.5GB storage sufficient for years of generator usage logs
- Cold starts acceptable for beta users (5-10 seconds)
- True PostgreSQL provides production-grade reliability
- Easy to test and validate before investing in paid infrastructure

### Phase 2: Production (10-100 users)
**Database**: Neon PostgreSQL (Free tier) OR Azure Database for PostgreSQL B1ms
**Compute**: Azure App Service B1 OR Azure Container Instances
**Total Cost**: **$13-30/month**

**Upgrade triggers**:
- Storage exceeds 0.5GB (unlikely based on projections)
- Cold starts become problematic for user experience
- Azure-native requirement for compliance/audit
- Need guaranteed SLA and performance

---

## Architecture Decisions

### Database Connection
```typescript
// Environment variable based configuration
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

// Support both cloud and local PostgreSQL
// - Cloud: Neon or Azure Database for PostgreSQL
// - Local: Self-hosted PostgreSQL (user-provided)
```

### Local Development Options
1. **Docker Compose** with PostgreSQL container (recommended)
2. **User-provided PostgreSQL** server (self-hosted)
3. **Neon free tier** database branching for dev environments

### Deployment Scenarios
1. **Cloud (Azure)**: App Service or ACI + PostgreSQL (Neon or Azure managed)
2. **Local Server**: Docker container + user-provided PostgreSQL
3. **Development**: Docker Compose with local PostgreSQL

---

## Data Size Projections

**Estimated storage requirements**:
- Users: 100 users × 1KB/user = 100KB
- Generator logs: 10,000 entries/year × 500 bytes = 5MB/year
- Total after 5 years: ~25MB + indexes ≈ **50MB**

**Conclusion**: Neon's 0.5GB free tier provides **10x headroom** for projected usage

---

## Migration Path

### From Neon Free to Azure PostgreSQL
```bash
# Simple pg_dump migration
pg_dump $NEON_DATABASE_URL | psql $AZURE_DATABASE_URL
```

**Effort**: Low (standard PostgreSQL, no vendor-specific features)

### SQLite NOT Chosen for Cloud
SQLite remains viable for:
- Pure local deployments (single machine)
- Development/testing environments
- Embedded use cases

But rejected for cloud multi-user deployment due to:
- Network filesystem limitations
- Concurrent access issues
- Horizontal scaling blockers

---

## Consequences

### Positive
- ✅ **$0 beta phase** enables risk-free testing
- ✅ **Production-grade database** from day one (PostgreSQL)
- ✅ **Multi-user support** with excellent concurrent access
- ✅ **Flexible deployment** (cloud and local)
- ✅ **Standard tooling** (Drizzle ORM, pg driver, pgAdmin, etc.)
- ✅ **Easy migration** between PostgreSQL providers
- ✅ **Open source friendly** - users can self-host with own PostgreSQL

### Negative
- ⚠️ **External dependency** on Neon for free tier (mitigated: standard PostgreSQL)
- ⚠️ **Cold starts** in free tier (acceptable for low-traffic app)
- ⚠️ **Storage limit monitoring** required (0.5GB)
- ⚠️ **More complex than SQLite** for pure local deployments

### Neutral
- Database choice doesn't significantly impact codebase (Drizzle ORM abstracts)
- Migration between PostgreSQL providers is straightforward
- Users deploying locally need to provide PostgreSQL (documented)

---

## Implementation Requirements

### 1. Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Optional (parsed from DATABASE_URL)
DB_HOST=host
DB_PORT=5432
DB_NAME=dbname
DB_USER=user
DB_PASSWORD=password
DB_SSL=true
```

### 2. Dependencies
```json
{
  "dependencies": {
    "pg": "^8.13.1",
    "drizzle-orm": "^0.39.3",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.2",
    "@types/pg": "^8.16.0"
  }
}
```

### 3. Docker Compose (Local Development)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: generatorlog
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 4. Deployment Documentation
Create guides for:
- Cloud deployment (Azure App Service + Neon)
- Local deployment (Docker + PostgreSQL)
- Environment configuration
- Database migrations

---

## Security Considerations

### Database Connection Security
- ✅ Always use SSL/TLS (`sslmode=require`)
- ✅ Store credentials in Azure Key Vault or environment variables
- ✅ Use managed identity for Azure Database for PostgreSQL (production)
- ✅ Never commit connection strings to git

### Network Isolation
- Azure: Use Virtual Network integration (production)
- Local: Use Docker internal networking

### Backup Strategy
- Cloud: Automatic backups by provider (Neon, Azure)
- Local: Users responsible for own backup procedures (documented)

---

## References

- [Database Research Document](../00002-embedded-database-research.md)
- [Azure Deployment Research](../00003-azure-cloud-deployment-research.md)
- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [Azure Database for PostgreSQL Documentation](https://learn.microsoft.com/azure/postgresql/)
- [SQLite When To Use](https://www.sqlite.org/whentouse.html)
- [Drizzle ORM PostgreSQL Guide](https://orm.drizzle.team/docs/get-started-postgresql)

---

## Notes

This ADR documents the decision to use PostgreSQL over SQLite for cloud deployment based on:
1. Multi-user concurrent access requirements
2. Cloud infrastructure limitations (Azure Files file locking)
3. Cost optimization through free tier usage
4. Production-grade reliability needs
5. Open source deployment flexibility

SQLite was thoroughly researched and remains an excellent choice for local-only deployments, but the cloud multi-user context makes PostgreSQL the clear winner.
