import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';
import config from '../src/config.js';
import * as schema from '../src/db/schema.js';

/**
 * Generate a cryptographically secure 64-character hex API key
 */
function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Delete existing test data (idempotent cleanup)
 * Deletes in FK constraint order: usageLogs → apiKeys → generators → users
 */
async function cleanupTestData(db: ReturnType<typeof drizzle>) {
  const testEmail = 'test@example.com';

  // Find test user
  const testUsers = await db.select().from(schema.users).where(eq(schema.users.email, testEmail));

  if (testUsers.length === 0) {
    console.log('No existing test data to clean up.');
    return;
  }

  const testUserId = testUsers[0].id;

  // Get test user's generators
  const testGenerators = await db.select().from(schema.generators).where(eq(schema.generators.userId, testUserId));

  if (testGenerators.length > 0) {
    const generatorIds = testGenerators.map(g => g.id);

    // Delete usage logs (FK to generators)
    for (const genId of generatorIds) {
      await db.delete(schema.usageLogs).where(eq(schema.usageLogs.generatorId, genId));
    }
  }

  // Delete API keys (FK to users)
  await db.delete(schema.apiKeys).where(eq(schema.apiKeys.userId, testUserId));

  // Delete generators (FK to users)
  await db.delete(schema.generators).where(eq(schema.generators.userId, testUserId));

  // Delete user
  await db.delete(schema.users).where(eq(schema.users.id, testUserId));

  console.log('Cleaned up existing test data.\n');
}

/**
 * Create seed data for testing
 */
async function createSeedData(db: ReturnType<typeof drizzle>) {
  // 1. Create test user
  const [user] = await db.insert(schema.users).values({
    email: 'test@example.com',
    oauthProvider: null,
    oauthId: null,
  }).returning();

  // 2. Create generator with realistic data
  // Total hours: 125.5
  // Last oil change: 75.0 hours (6+ months ago)
  // Hours since oil change: 50.5 (triggers maintenance reminder)
  const [generator] = await db.insert(schema.generators).values({
    userId: user.id,
    name: 'Test Generator - Honda EU2200i',
    totalHours: 125.5,
    lastOilChangeDate: new Date('2025-08-01T10:00:00Z'),
    lastOilChangeHours: 75.0,
    isRunning: false,
    currentStartTime: null,
  }).returning();

  // 3. Generate API key
  const apiKeyValue = generateApiKey();
  const [apiKey] = await db.insert(schema.apiKeys).values({
    userId: user.id,
    key: apiKeyValue,
    name: 'Test API Key - Postman',
  }).returning();

  // 4. Create historical usage logs (5 entries totaling ~50.5 hours)
  const usageLogsData = [
    {
      generatorId: generator.id,
      startTime: new Date('2025-09-15T14:00:00Z'),
      endTime: new Date('2025-09-15T16:30:00Z'),
      durationHours: 2.5,
    },
    {
      generatorId: generator.id,
      startTime: new Date('2025-10-10T09:00:00Z'),
      endTime: new Date('2025-10-10T21:45:00Z'),
      durationHours: 12.75,
    },
    {
      generatorId: generator.id,
      startTime: new Date('2025-11-05T18:00:00Z'),
      endTime: new Date('2025-11-06T02:00:00Z'),
      durationHours: 8.0,
    },
    {
      generatorId: generator.id,
      startTime: new Date('2025-12-20T07:30:00Z'),
      endTime: new Date('2025-12-20T20:45:00Z'),
      durationHours: 13.25,
    },
    {
      generatorId: generator.id,
      startTime: new Date('2026-01-15T10:00:00Z'),
      endTime: new Date('2026-01-16T00:00:00Z'),
      durationHours: 14.0,
    },
  ];

  await db.insert(schema.usageLogs).values(usageLogsData);

  // Output summary
  console.log('✅ Database seeded successfully!\n');
  console.log('Test User Created:');
  console.log(`  Email: ${user.email}`);
  console.log(`  ID: ${user.id}\n`);

  console.log('Generator Created:');
  console.log(`  ID: ${generator.id}`);
  console.log(`  Name: ${generator.name}`);
  console.log(`  Total Hours: ${generator.totalHours}`);
  console.log(`  Last Oil Change: ${generator.lastOilChangeHours} hours`);
  console.log(`  Hours Since Oil Change: ${generator.totalHours - (generator.lastOilChangeHours || 0)}`);
  console.log(`  Is Running: ${generator.isRunning}\n`);

  console.log('API Key Generated:');
  console.log(`  Key: ${apiKeyValue}`);
  console.log(`  Name: ${apiKey.name}\n`);

  console.log('📋 Copy this API key for Postman testing:');
  console.log(`  ${apiKeyValue}\n`);

  console.log(`Historical Usage Logs Created: ${usageLogsData.length} entries\n`);

  console.log('Next steps:');
  console.log('  1. Start the server: pnpm --filter generatorlog-backend dev');
  console.log('  2. Import the Postman collection from docs/postman/');
  console.log('  3. Update the apiKey variable in Postman with the key above');
  console.log('  4. Test the toggle endpoint!\n');
}

/**
 * Main seed function
 */
async function seed() {
  console.log('🌱 Seeding database...\n');

  const pool = new Pool({
    connectionString: config.database.url || undefined,
    host: config.database.url ? undefined : config.database.host,
    port: config.database.url ? undefined : config.database.port,
    database: config.database.url ? undefined : config.database.name,
    user: config.database.url ? undefined : config.database.user,
    password: config.database.url ? undefined : config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  try {
    await cleanupTestData(db);
    await createSeedData(db);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
