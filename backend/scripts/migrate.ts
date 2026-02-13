import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import config from '../src/config.js';

async function runMigrations() {
  console.log('Running database migrations...');

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

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
