# Embedded Database Research for GeneratorLog

**Date**: 2026-02-11
**Status**: Research Phase
**Author**: Claude Code

## Executive Summary

This document evaluates embedded database solutions for GeneratorLog that can work in a single Docker container without external database servers. The goal is to simplify deployment while maintaining data persistence through Docker volume mounts.

**Project Requirements**:
- TypeScript/Node.js 25.2.1 compatibility
- Drizzle ORM support
- File-based persistence that survives container restarts
- Suitable for low-traffic home automation (not high-scale)
- Minimal dependencies (align with CLAUDE.md philosophy)
- Simple Docker volume mounting for data persistence

**Recommendation**: **SQLite with better-sqlite3** or **libSQL/Turso** (both excellent choices)

**Why SQLite/libSQL**:
1. **Mature & Production-Ready**: SQLite is the most deployed database in the world
2. **Drizzle ORM Support**: Native, first-class support
3. **Zero Dependencies**: SQLite has no external dependencies
4. **File-Based**: Single database file, perfect for Docker volumes
5. **Performance**: Excellent for low-to-medium traffic CRUD applications
6. **Minimal Complexity**: No separate database server to manage

---

## Option 1: SQLite with better-sqlite3

### Overview
SQLite is a C-language library implementing a small, fast, self-contained SQL database engine. `better-sqlite3` is the fastest and most feature-complete Node.js SQLite driver.

### Technical Specifications
- **Driver**: better-sqlite3 (native C++ addon)
- **API Style**: Synchronous (faster than async for SQLite)
- **Node.js Version**: Requires Node.js v14.21.1+
- **TypeScript Support**: TypeScript definitions available via @types/better-sqlite3
- **Current Version**: v12.6.2 (January 2026)
- **Adoption**: 175,000+ dependent projects

### Drizzle ORM Compatibility
✅ **Full Native Support**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('./data/generator.db');
const db = drizzle(sqlite);
```

Drizzle documentation states: "Drizzle has native support for SQLite connections with the `better-sqlite3` driver."

### File-Based Persistence
✅ **Perfect for Docker Volumes**

```dockerfile
# Dockerfile volume mount
VOLUME ["/app/data"]

# docker-compose.yml
volumes:
  - ./data:/app/data
```

SQLite stores everything in a single file (e.g., `generator.db`), making it trivial to persist with Docker volumes.

### Performance Characteristics
⭐ **Excellent for CRUD Applications**

Benchmark results (vs competing Node.js SQLite libraries):
- **Single row SELECT**: 1x baseline (competitors 11.7x slower)
- **Iterate 100 rows**: 1x baseline (competitors 24.4x slower)
- **Batch INSERT**: 1x baseline (competitors 15.6x slower)

**Synchronous API Advantage**: Eliminates async overhead, better concurrency than async for embedded databases.

### Production Readiness
✅ **Extremely Mature**

- **SQLite**: Most deployed database in the world (billions of active installations)
- **better-sqlite3**: 6,900+ GitHub stars, 1,574 commits, 115 releases
- **Stability**: Used in production by major projects
- **Maintenance**: Active development, latest release January 2026

### Community Support
✅ **Massive Community**

- **SQLite**: 40+ years of development, extensive documentation
- **better-sqlite3**: Large community, well-documented, responsive maintainers
- **StackOverflow**: 100,000+ SQLite questions
- **Resources**: Comprehensive guides, tutorials, best practices

### Migration from PostgreSQL
⚠️ **Moderate Effort Required**

**Key Differences**:
1. **Data Types**: SQLite uses dynamic typing (TEXT, INTEGER, REAL, BLOB, NULL)
2. **No SERIAL**: Use `INTEGER PRIMARY KEY AUTOINCREMENT` instead
3. **Limited ALTER TABLE**: Cannot drop/modify columns (must recreate table)
4. **No Schemas**: Single namespace (no `public.users`, just `users`)
5. **Simplified JSON**: Basic JSON1 extension (not as rich as PostgreSQL JSONB)

**Migration Strategy**:
- Use Drizzle schema definitions (abstracts most differences)
- Simple CRUD queries work identically
- Avoid PostgreSQL-specific features (ARRAY types, advanced JSON operators)

### Strengths
✅ **Zero Configuration**: No server setup, just open a file
✅ **Single File**: Entire database in one file, easy backups
✅ **Fast Performance**: Excellent for read-heavy and moderate write workloads
✅ **ACID Compliant**: Full transactional support
✅ **No Dependencies**: Self-contained library
✅ **Minimal Memory**: Low memory footprint
✅ **Cross-Platform**: Works identically on all platforms
✅ **Battle-Tested**: Decades of production use

### Weaknesses
❌ **Single Writer**: Only one process can write at a time (fine for single-container apps)
❌ **Limited Concurrency**: Not suitable for high concurrent write workloads
❌ **File Locks**: Can cause issues with network file systems (use local volumes)
❌ **Type System**: Dynamic typing may require more validation
❌ **ALTER TABLE Limitations**: Schema changes can be cumbersome
❌ **No Replication**: No built-in replication (see libSQL for this)

### Minimal Dependencies Score: 10/10
⭐ **Perfect Alignment**
- Single npm package: `better-sqlite3`
- Zero external dependencies
- No database server required
- Minimal Docker image footprint

### Use Case Fit for GeneratorLog: 10/10
⭐ **Ideal Match**
- Low traffic (home automation)
- Simple CRUD operations
- Single-user database writes (one generator per user)
- Docker volume persistence
- Minimal operational complexity

---

## Option 2: libSQL/Turso

### Overview
libSQL is an open-source fork of SQLite created by Turso, adding enhanced features while maintaining SQLite compatibility. It supports both local embedded use and remote server connections.

### Technical Specifications
- **Driver**: @libsql/client (official TypeScript/JavaScript driver)
- **API Style**: Async/await
- **Compatibility**: 100% SQLite file format compatible
- **Current Status**: 16,300+ GitHub stars, 55+ releases (latest February 2025)
- **Maintained By**: Turso (commercial backing)

### Drizzle ORM Compatibility
✅ **Full Native Support**

```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const client = createClient({
  url: 'file:./data/generator.db'
});
const db = drizzle(client);
```

Drizzle documentation explicitly lists libSQL as a native supported driver with enhanced capabilities over better-sqlite3.

### File-Based Persistence
✅ **Identical to SQLite**

Uses SQLite file format, so Docker volume mounting works exactly the same:
```yaml
volumes:
  - ./data:/app/data
```

**Additional Feature**: Can switch to remote Turso cloud database without code changes (just change connection URL).

### Enhanced Features Over SQLite
⭐ **Notable Additions**

1. **Embedded Replicas**: In-app database replication
2. **Remote Connections**: Can connect to Turso cloud or self-hosted servers
3. **Enhanced ALTER TABLE**: More column modification options
4. **WebAssembly UDFs**: User-defined functions in WASM
5. **Randomized ROWID**: Better security for exposed IDs
6. **Virtual WAL Interface**: Pluggable write-ahead logging

### Performance Characteristics
⭐ **Comparable to SQLite**

libSQL maintains SQLite's performance profile:
- Same on-disk format
- Same query optimizer
- Same B-tree implementation
- Minimal overhead for enhanced features

**Trade-off**: Async API (vs better-sqlite3 sync) adds slight overhead but enables remote connections.

### Production Readiness
✅ **Production-Ready with Caveats**

- **Maturity**: Newer than SQLite (fork created 2022) but built on SQLite foundation
- **Adoption**: Growing ecosystem, multiple GUI tools support it
- **Commercial Backing**: Turso provides enterprise support
- **Active Development**: Regular releases, responsive maintainers

**Consideration**: Less battle-tested than SQLite, but inherits SQLite's stability.

### Community Support
⭐⭐⭐⭐ **Good and Growing**

- **GitHub**: 16,300+ stars, active issues/PRs
- **Documentation**: Comprehensive official docs
- **Turso Community**: Active Discord, responsive support
- **Tooling**: Beekeeper Studio, TablePlus, Outerbase support

### Migration from PostgreSQL
⚠️ **Same as SQLite**

libSQL uses SQLite compatibility, so migration considerations are identical to Option 1.

**Advantage**: If you later need PostgreSQL features, Turso offers managed cloud databases that might ease migration.

### Strengths
✅ **SQLite Compatibility**: Drop-in replacement for SQLite
✅ **Future-Proof**: Can migrate to remote database without code changes
✅ **Enhanced Features**: More ALTER TABLE options, embedded replicas
✅ **Open Source**: Fork with community contributions
✅ **Flexible Deployment**: Local file or remote server
✅ **Good Drizzle Support**: Native integration
✅ **Community-Driven**: Accepts contributions rejected by SQLite upstream

### Weaknesses
❌ **Less Mature**: Newer than SQLite (2022 vs 2000)
❌ **Smaller Community**: Not as widespread as SQLite
❌ **Async Only**: No synchronous API option (better-sqlite3 is faster for local use)
❌ **Additional NPM Package**: One more dependency than raw SQLite
❌ **Commercial Ties**: Maintained by company (Turso) vs SQLite's non-profit foundation

### Minimal Dependencies Score: 9/10
⭐ **Excellent Alignment**
- Single npm package: `@libsql/client`
- No external services required (for local use)
- Optional cloud features available

### Use Case Fit for GeneratorLog: 9/10
⭐ **Excellent Match**
- All SQLite benefits apply
- Future flexibility (can scale to remote database later)
- Enhanced features may be useful for multi-user expansion
- Docker volume persistence works identically

---

## Option 3: PGlite (PostgreSQL in WebAssembly)

### Overview
PGlite is a WebAssembly build of PostgreSQL designed for embedded use in browsers and Node.js. It provides a full PostgreSQL database running locally without a server.

### Technical Specifications
- **Size**: Under 3MB gzipped (remarkable for full Postgres)
- **Engine**: Full PostgreSQL compiled to WASM
- **API Style**: Async/await
- **Current Version**: 0.x.x (alpha stage, v0.0.20 as of January 2026)
- **Status**: ⚠️ **ALPHA** - Not production-ready

### Drizzle ORM Compatibility
✅ **Supported**

Drizzle documentation lists PGlite as a supported connection option:
```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const client = new PGlite('./path/to/pgdata');
const db = drizzle(client);
```

### File-Based Persistence
✅ **Multiple Options**

- **Node.js**: `new PGlite('./path/to/pgdata')` - native filesystem
- **Browser**: `new PGlite('idb://my-pgdata')` - IndexedDB
- **Memory**: `new PGlite()` - in-memory only

For Docker:
```yaml
volumes:
  - ./pgdata:/app/pgdata
```

### Performance Characteristics
⚠️ **Unknown for Production**

- **OLAP Queries**: Claims good performance for analytical workloads
- **OLTP/CRUD**: Performance characteristics not well-documented
- **WASM Overhead**: WebAssembly adds performance overhead vs native
- **Parallel Execution**: Supports parallel query execution
- **Memory**: Can process larger-than-memory workloads

**Caveat**: Alpha status means benchmarks may not reflect final performance.

### Production Readiness
❌ **NOT PRODUCTION-READY**

**Critical Limitations**:
1. **Alpha Status**: Explicit "Status - Alpha" badge
2. **Single Connection**: "PGlite is single user/connection" - cannot handle concurrent connections
3. **API Instability**: 0.x.x versioning indicates breaking changes expected
4. **Limited Testing**: Edge cases likely undiscovered

**Suitable For**: Experimentation, prototyping, offline-first apps accepting data loss risk

**NOT Suitable For**: Production applications requiring stability and reliability

### Community Support
⭐⭐⭐ **Early Stage**

- **Project**: Electric SQL (well-funded, reputable team)
- **Documentation**: Good for alpha project
- **Community**: Growing, but small compared to SQLite/PostgreSQL
- **Updates**: Active development, frequent releases

### Migration from PostgreSQL
✅ **Perfect Compatibility**

**Major Advantage**: PGlite IS PostgreSQL, so migration is trivial:
- Same SQL dialect
- Same data types (SERIAL, JSONB, ARRAY, etc.)
- Same functions and operators
- Drizzle schemas work identically

**Migration Path**: Copy PostgreSQL schema and data directly (if you later move to full PostgreSQL)

### Strengths
✅ **Full PostgreSQL**: All PostgreSQL features available
✅ **No Migration**: If coming from PostgreSQL
✅ **Small Size**: 3MB is impressive for full database
✅ **Extensions**: Supports pgvector and other extensions
✅ **Innovative**: Cutting-edge technology (WASM Postgres)
✅ **Reactive Features**: Built-in data sync and live query primitives
✅ **Cross-Platform**: Works in browsers too

### Weaknesses
❌ **Alpha Status**: Not production-ready (CRITICAL)
❌ **Single Connection**: Cannot handle concurrency (CRITICAL)
❌ **Performance**: WASM overhead vs native databases
❌ **Immaturity**: API may change, bugs likely
❌ **Limited Documentation**: Compared to SQLite/PostgreSQL
❌ **No Track Record**: No proven production deployments
❌ **Uncertain Future**: Project could stall or pivot

### Minimal Dependencies Score: 8/10
⭐ **Good Alignment**
- Single npm package: `@electric-sql/pglite`
- No external database server
- Self-contained WASM binary

### Use Case Fit for GeneratorLog: 3/10
❌ **Not Recommended**

While technologically impressive, the alpha status and single-connection limitation make PGlite unsuitable for GeneratorLog:
- Home automation requires reliability
- Cannot risk data loss or API breakage
- Single connection is too limiting
- Better options exist (SQLite, libSQL)

**Best Use Case**: Future option when it reaches stable 1.0 release

---

## Option 4: DuckDB (Analytical Database)

### Overview
DuckDB is an in-process OLAP (Online Analytical Processing) database designed for analytical queries, not transactional CRUD operations.

### Technical Specifications
- **Type**: OLAP (Analytical) not OLTP (Transactional)
- **Driver**: @duckdb/node-api
- **File Support**: Parquet, CSV, JSON direct querying
- **Current Version**: Stable, production-ready for analytics
- **Design Goal**: Fast analytical queries, not CRUD workloads

### Drizzle ORM Compatibility
❌ **NOT Supported**

Drizzle ORM documentation does not list DuckDB as a supported database. This is a CRITICAL blocker.

### File-Based Persistence
✅ **Excellent for Analytics**

DuckDB excels at querying files directly:
```javascript
db.run("SELECT * FROM 'data.parquet'");
db.run("SELECT * FROM 'logs.csv'");
```

Can persist database to file, but this is secondary to its analytical capabilities.

### Performance Characteristics
⭐⭐⭐⭐⭐ **Excellent for Analytics**
❌ **Wrong Use Case for CRUD**

DuckDB is optimized for:
- Aggregations (SUM, COUNT, AVG)
- Large dataset scans
- Complex analytical queries
- Parallel execution
- Larger-than-memory workloads

**Not optimized for**:
- Individual record INSERT/UPDATE/DELETE
- High-frequency small transactions
- Concurrent writes
- OLTP workloads (like web CRUD apps)

### Production Readiness
✅ **Production-Ready for Analytics**
❌ **Wrong Tool for CRUD Apps**

DuckDB is mature and stable for its intended use case (analytical queries), but that's not GeneratorLog's use case.

### Community Support
⭐⭐⭐⭐ **Strong for Analytics**

- Large community in data engineering/analytics space
- Excellent documentation
- Growing ecosystem

### Migration from PostgreSQL
⚠️ **Feasible but Misaligned**

While DuckDB supports SQL and could theoretically work, it's architecturally misaligned:
- PostgreSQL is OLTP (transactional)
- DuckDB is OLAP (analytical)
- Using DuckDB for CRUD is like using MongoDB for relational data - technically possible, but wrong tool

### Strengths
✅ **Blazing Fast**: For analytical queries
✅ **File Querying**: Query CSV/Parquet directly
✅ **Parallel Execution**: Excellent resource utilization
✅ **SQL Support**: Full SQL dialect
✅ **Larger-than-Memory**: Can handle huge datasets

### Weaknesses (for GeneratorLog use case)
❌ **No Drizzle Support**: Cannot use with Drizzle ORM
❌ **Wrong Design**: Built for analytics, not CRUD
❌ **OLAP vs OLTP**: Architectural mismatch
❌ **Transactional Overhead**: Not optimized for small frequent writes
❌ **Concurrency Model**: Different concurrency assumptions

### Minimal Dependencies Score: 7/10
⭐ **Good if it matched use case**
- Single package: `@duckdb/node-api`
- No external server

### Use Case Fit for GeneratorLog: 1/10
❌ **Strongly NOT Recommended**

DuckDB is the wrong tool for GeneratorLog:
- GeneratorLog needs CRUD operations (INSERT usage logs, UPDATE generator state)
- DuckDB is designed for analytical queries (SUM running hours, GROUP BY month)
- No Drizzle ORM support is a blocker
- Architectural mismatch

**Best Use Case**: If you later add analytics dashboard showing usage trends and statistics, DuckDB could query historical data. But use SQLite for primary database.

---

## Option 5: Bun SQLite (Runtime Built-in)

### Overview
Bun (JavaScript runtime) includes a built-in SQLite implementation with zero dependencies.

### Technical Specifications
- **Availability**: Only in Bun runtime (not Node.js 25.2.1)
- **API**: Native Bun.js API
- **Performance**: Highly optimized, faster than better-sqlite3
- **Zero Install**: Built into Bun runtime

### Drizzle ORM Compatibility
✅ **Supported in Bun**

```typescript
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database("generator.db");
const db = drizzle(sqlite);
```

### Critical Limitation
❌ **Requires Bun Runtime**

GeneratorLog uses **Node.js 25.2.1** (per `.node-version` file), so Bun SQLite is **NOT COMPATIBLE**.

### Use Case Fit for GeneratorLog: 0/10
❌ **Not Applicable**

Would be excellent if using Bun, but project uses Node.js.

---

## Option 6: Other Embedded Options (Brief Overview)

### LevelDB / Level
- **Type**: Key-value store (not SQL)
- **Drizzle Support**: ❌ No
- **Use Case**: Caching, logs, not structured data
- **Verdict**: ❌ Needs SQL for Drizzle ORM

### LowDB
- **Type**: JSON file database (like localStorage)
- **Drizzle Support**: ❌ No
- **Use Case**: Simple config, prototypes
- **Performance**: ❌ Reads entire file into memory
- **Verdict**: ❌ Not suitable for production CRUD

### ImmortalDB
- **Type**: Browser persistence layer
- **Drizzle Support**: ❌ No
- **Use Case**: Browser-only applications
- **Verdict**: ❌ Not for Node.js backend

---

## Comparison Matrix

| Criteria | SQLite (better-sqlite3) | libSQL/Turso | PGlite | DuckDB | Bun SQLite |
|----------|------------------------|--------------|--------|---------|------------|
| **Drizzle ORM Support** | ✅ Native | ✅ Native | ✅ Supported | ❌ No | ✅ Bun only |
| **Production Ready** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ Alpha | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **File Persistence** | ✅ Single file | ✅ Single file | ✅ Multi-file | ✅ Yes | ✅ Single file |
| **Docker Volume Friendly** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **CRUD Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Minimal Dependencies** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maturity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Community Size** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **PostgreSQL Compatibility** | ❌ No | ❌ No | ✅ Full | ⚠️ SQL | ❌ No |
| **Concurrency** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ (single) | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Use Case Fit** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ❌ N/A |
| **Node.js 25.2.1** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Bun only |

### Scoring Legend
- ⭐⭐⭐⭐⭐ Excellent
- ⭐⭐⭐⭐ Very Good
- ⭐⭐⭐ Good
- ⭐⭐ Fair
- ⭐ Poor
- ❌ Not Supported / Not Applicable

---

## Detailed Recommendations

### Primary Recommendation: SQLite with better-sqlite3

**Why SQLite is Best for GeneratorLog**:

1. **Maturity (5/5)**: Most deployed database in the world, 40+ years of production use
2. **Minimal Dependencies (5/5)**: Single npm package, zero external services
3. **Performance (5/5)**: Excellent for low-to-medium traffic CRUD operations
4. **Simplicity (5/5)**: No database server, no configuration, just open a file
5. **Drizzle Support (5/5)**: Native first-class integration
6. **Docker Friendly (5/5)**: Single file, trivial volume mounting
7. **Self-Documenting (5/5)**: With Drizzle schemas, code is clear and typed

**Perfect Alignment with CLAUDE.md**:
- ✅ Minimal dependencies (just better-sqlite3)
- ✅ Self-documenting (Drizzle schema + TypeScript types)
- ✅ Concise code (no ORM complexity)
- ✅ Production-ready (battle-tested)

**Setup Example**:
```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './data/generator.db'
  }
} satisfies Config;

// src/db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('./data/generator.db');
export const db = drizzle(sqlite, { schema });
```

**Docker Setup**:
```yaml
# docker-compose.yml
services:
  app:
    build: .
    volumes:
      - ./data:/app/data  # SQLite file persists here
    environment:
      - DATABASE_PATH=/app/data/generator.db
```

### Alternative Recommendation: libSQL/Turso

**Why libSQL is Also Excellent**:

libSQL offers all of SQLite's benefits PLUS future flexibility:

1. **Future-Proof**: Can migrate to remote Turso database without code changes
2. **Enhanced Features**: Better ALTER TABLE, embedded replicas
3. **Same Simplicity**: File-based like SQLite
4. **Drizzle Support**: Native integration
5. **Commercial Backing**: Turso provides support if needed

**When to Choose libSQL over SQLite**:
- You might want remote database access later
- You need enhanced SQLite features (advanced ALTER TABLE)
- You want community-driven development vs SQLite's limited contributions
- You're comfortable with slightly newer technology (2022 vs 2000)

**Trade-off**: Marginally less mature than SQLite, but still production-ready.

**Setup Example**:
```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const client = createClient({
  url: 'file:./data/generator.db'
  // Later can switch to: url: 'libsql://your-db.turso.io'
});

export const db = drizzle(client);
```

### NOT Recommended

**PGlite**: ❌ Alpha status, single-connection limitation
**DuckDB**: ❌ Wrong tool (OLAP not OLTP), no Drizzle support
**Bun SQLite**: ❌ Not compatible with Node.js 25.2.1
**LowDB/LevelDB**: ❌ No SQL, no Drizzle support

---

## Migration from PostgreSQL Considerations

### If You're Currently Using PostgreSQL (from docker-compose.yml)

The current `docker-compose.yml` shows PostgreSQL as the database. Here's what migration to SQLite/libSQL would involve:

### Schema Migration

**Drizzle Makes This Easy**: Drizzle ORM abstracts most differences.

**Changes Needed**:

1. **Auto-increment ID**:
```typescript
// PostgreSQL
id: serial('id').primaryKey()

// SQLite
id: integer('id').primaryKey({ autoIncrement: true })
```

2. **Timestamps**:
```typescript
// PostgreSQL
createdAt: timestamp('created_at').defaultNow()

// SQLite
createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
```

3. **JSON Fields**:
```typescript
// PostgreSQL
metadata: jsonb('metadata')

// SQLite
metadata: text('metadata', { mode: 'json' }).$type<YourType>()
```

4. **Remove Schemas**:
SQLite doesn't support schemas like PostgreSQL's `public.users`. Just use `users`.

### Data Migration

```typescript
// Export from PostgreSQL
pg-dump generatorlog > backup.sql

// Convert to SQLite
// Use online converters or write custom migration script with Drizzle
```

**Better Approach**: Start fresh with SQLite (GeneratorLog is new project).

### SQL Compatibility

**Works Identically**:
- SELECT, INSERT, UPDATE, DELETE
- WHERE clauses, JOINs
- ORDER BY, LIMIT, OFFSET
- Transactions (BEGIN, COMMIT, ROLLBACK)
- Indexes, constraints

**SQLite Limitations**:
- No DROP COLUMN in ALTER TABLE (must recreate table)
- No ARRAY types (use JSON)
- Limited ALTER TABLE options
- No separate user permissions (not needed for embedded DB)

---

## Docker Persistence Best Practices

### Recommended Docker Setup

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - sqlite_data:/app/data  # Named volume (production)
      # OR
      - ./data:/app/data       # Bind mount (development)
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/generator.db

volumes:
  sqlite_data:  # Persistent named volume
```

### Data Backup Strategy

```bash
# Backup script (cron job)
docker cp generatorlog-app-1:/app/data/generator.db ./backups/generator-$(date +%Y%m%d).db

# Restore
docker cp ./backups/generator-20260211.db generatorlog-app-1:/app/data/generator.db
```

### File Permissions

```dockerfile
# Dockerfile
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

# Ensures SQLite can write to /app/data
```

---

## Performance Expectations for GeneratorLog

### Expected Load (Home Automation)
- **Users**: 1-10 users
- **Writes**: 2-10 per day (start/stop generator)
- **Reads**: 10-100 per day (dashboard views)
- **Concurrency**: 1-2 concurrent requests max

### SQLite Performance at This Scale
⭐⭐⭐⭐⭐ **Perfect Match**

- SQLite handles 100,000+ reads/sec
- Handles 1,000+ writes/sec
- ACID transactions
- Sub-millisecond query times

**Overkill**: SQLite is MASSIVELY over-provisioned for this workload. Performance will be excellent.

### When to Migrate Away from SQLite

Only consider alternatives when:
- 10,000+ concurrent users
- 1,000+ writes/second
- Multiple application servers (distributed writes)
- Complex replication requirements

**For GeneratorLog**: ❌ Will NEVER hit these limits.

---

## AI Code Generation Considerations

### Drizzle ORM Benefits for AI

1. **Type-Safe Schemas**: AI can generate correct schemas with TypeScript types
2. **Self-Documenting**: Schema IS documentation
3. **Database Agnostic**: AI doesn't need to know SQLite vs PostgreSQL internals
4. **Migration Generation**: `drizzle-kit generate` auto-creates migrations

### better-sqlite3 Simplicity for AI

```typescript
// AI can easily generate this pattern
const user = db.select().from(users).where(eq(users.id, userId)).get();

// vs complex raw SQL
const result = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

### Minimal Comments Needed

With Drizzle + TypeScript:
```typescript
// Schema is self-documenting - no comments needed!
export const generators = sqliteTable('generators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  oilChangeIntervalHours: integer('oil_change_interval_hours').notNull(),
  oilChangeIntervalMonths: integer('oil_change_interval_months').notNull(),
  totalRunningHours: real('total_running_hours').notNull().default(0),
  lastOilChangeDate: integer('last_oil_change_date', { mode: 'timestamp' }),
  isRunning: integer('is_running', { mode: 'boolean' }).notNull().default(false),
  currentSessionStart: integer('current_session_start', { mode: 'timestamp' })
});
```

Types explain everything - no comments required (aligns with CLAUDE.md).

---

## Security Considerations

### SQLite-Specific Security

1. **No Network Exposure**: SQLite is in-process, no network attack surface
2. **File Permissions**: Ensure database file has correct permissions
3. **SQL Injection**: Use Drizzle ORM (parameterized queries)
4. **Backups**: Encrypt backup files before storing externally

### Docker Security

```dockerfile
# Run as non-root user
USER node

# Minimal permissions
RUN chmod 700 /app/data
```

### OWASP Top 10 Compliance

SQLite + Drizzle addresses:
- **A03:2021 Injection**: Drizzle uses parameterized queries
- **A04:2021 Insecure Design**: ACID transactions, type safety
- **A05:2021 Security Misconfiguration**: No exposed database port

---

## Final Recommendation Summary

### For GeneratorLog: Use SQLite with better-sqlite3

**Reasoning**:
1. ✅ Minimal dependencies (1 package)
2. ✅ Production-ready (40+ years of use)
3. ✅ Perfect for low-traffic CRUD
4. ✅ Trivial Docker persistence
5. ✅ Native Drizzle support
6. ✅ Self-documenting with TypeScript + Drizzle
7. ✅ Zero configuration
8. ✅ Excellent AI code generation support

**Package Count**: Just 1 (`better-sqlite3`)

**Alternative**: libSQL if you want future remote database flexibility

**Avoid**: PGlite (alpha), DuckDB (wrong use case), Bun SQLite (wrong runtime)

---

## Implementation Checklist

When user approves SQLite/libSQL:

- [ ] Install dependencies: `npm install better-sqlite3 drizzle-orm drizzle-kit`
- [ ] Create Drizzle schema (`src/schema.ts`)
- [ ] Configure drizzle.config.ts
- [ ] Create initial migration
- [ ] Update docker-compose.yml to remove PostgreSQL
- [ ] Add SQLite volume mount
- [ ] Update environment variables
- [ ] Test database persistence (restart container)
- [ ] Implement backup strategy
- [ ] Create ADR document in `docs/adr/` folder

---

## Next Steps

1. **User Decision**: Choose between:
   - **SQLite with better-sqlite3** (most mature, recommended)
   - **libSQL/Turso** (future-proof alternative)

2. **Create ADR**: Document the architectural decision in `docs/adr/00001-embedded-database-choice.md`

3. **Update Architecture**: Remove PostgreSQL from docker-compose.yml

4. **Implement Database**: Set up Drizzle schema and migrations

5. **Test Persistence**: Verify Docker volume mounting works correctly

---

## References

- **SQLite Official**: https://www.sqlite.org
- **better-sqlite3 GitHub**: https://github.com/WiseLibs/better-sqlite3
- **libSQL GitHub**: https://github.com/tursodatabase/libsql
- **Turso Documentation**: https://docs.turso.tech
- **PGlite GitHub**: https://github.com/electric-sql/pglite
- **DuckDB Official**: https://duckdb.org
- **Drizzle ORM Docs**: https://orm.drizzle.team
- **SQLite vs PostgreSQL**: https://www.sqlite.org/whentouse.html
- **Docker Volumes**: https://docs.docker.com/storage/volumes
