import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import config from '../src/config.js';

const MIGRATIONS_FOLDER = './drizzle';

// Migrations were re-baselined on 2026-07-05 (the original snapshot was
// gitignored, breaking db:generate). Databases created before then already
// have the full schema, so the baseline must be recorded as applied — not
// executed — the first time this runs against them.
async function recordBaselineIfSchemaExists(pool: InstanceType<typeof Pool>): Promise<void> {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'));
  const baseline = journal.entries[0];
  if (!baseline) return;

  const { rows: [check] } = await pool.query(`SELECT to_regclass('public.users') IS NOT NULL AS has_schema`);
  if (!check.has_schema) return; // fresh database — let the migrator execute the baseline

  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`
  );

  const { rows: [{ last }] } = await pool.query(`SELECT max(created_at) AS last FROM drizzle.__drizzle_migrations`);
  if (last !== null && Number(last) >= baseline.when) return; // baseline (or newer) already recorded

  const sqlText = readFileSync(path.join(MIGRATIONS_FOLDER, `${baseline.tag}.sql`), 'utf8');
  const hash = createHash('sha256').update(sqlText).digest('hex');
  await pool.query(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [hash, baseline.when]);
  console.log(`Existing schema detected — recorded baseline ${baseline.tag} as applied without executing it.`);
}

async function runMigrations() {
  console.log('Running database migrations...');

  // With DATABASE_URL, TLS is governed by the URL's sslmode (node-postgres
  // verifies certificates for sslmode=require). See src/db/index.ts.
  const pool = new Pool({
    connectionString: config.database.url || undefined,
    host: config.database.url ? undefined : config.database.host,
    port: config.database.url ? undefined : config.database.port,
    database: config.database.url ? undefined : config.database.name,
    user: config.database.url ? undefined : config.database.user,
    password: config.database.url ? undefined : config.database.password,
    ...(config.database.url ? {} : { ssl: config.database.ssl ? { rejectUnauthorized: true } : false }),
  });

  const db = drizzle(pool);

  try {
    await recordBaselineIfSchemaExists(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
