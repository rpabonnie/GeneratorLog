import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import config from './config.js';

const { Pool } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: config.database.url || undefined,
  host: config.database.url ? undefined : config.database.host,
  port: config.database.url ? undefined : config.database.port,
  database: config.database.url ? undefined : config.database.name,
  user: config.database.url ? undefined : config.database.user,
  password: config.database.url ? undefined : config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
});

const db = drizzle(pool);

console.log('Running database migrations...');
await migrate(db, { migrationsFolder: join(__dirname, '../drizzle') });
console.log('Migrations complete.');
await pool.end();
