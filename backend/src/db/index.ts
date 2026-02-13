import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import config from '../config.js';
import * as schema from './schema.js';

let pool: pkg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    pool = new Pool({
      connectionString: config.database.url || undefined,
      host: config.database.url ? undefined : config.database.host,
      port: config.database.url ? undefined : config.database.port,
      database: config.database.url ? undefined : config.database.name,
      user: config.database.url ? undefined : config.database.user,
      password: config.database.url ? undefined : config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    });

    db = drizzle(pool, { schema });
  }

  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
