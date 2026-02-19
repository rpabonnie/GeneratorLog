import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { hashApiKey } from '../utils/auth.js';

export interface StartGeneratorResult {
  status: 'started';
  isRunning: true;
  startTime: Date;
  totalHours: number;
}

export interface StopGeneratorResult {
  status: 'stopped';
  isRunning: false;
  durationHours: number;
  totalHours: number;
}

export type ToggleResult = StartGeneratorResult | StopGeneratorResult;

export async function toggleGenerator(generatorId: number): Promise<ToggleResult> {
  const db = getDb();

  // Get the current generator state
  const [generator] = await db
    .select()
    .from(schema.generators)
    .where(eq(schema.generators.id, generatorId))
    .limit(1);

  if (!generator) {
    throw new Error('Generator not found');
  }

  const now = new Date();

  if (!generator.isRunning) {
    // Start the generator
    await db
      .update(schema.generators)
      .set({
        isRunning: true,
        currentStartTime: now,
        updatedAt: now,
      })
      .where(eq(schema.generators.id, generatorId));

    return {
      status: 'started',
      isRunning: true,
      startTime: now,
      totalHours: generator.totalHours,
    };
  } else {
    // Stop the generator
    const startTime = generator.currentStartTime!;
    const durationMs = now.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const newTotalHours = generator.totalHours + durationHours;

    // Update generator state
    await db
      .update(schema.generators)
      .set({
        isRunning: false,
        currentStartTime: null,
        totalHours: newTotalHours,
        updatedAt: now,
      })
      .where(eq(schema.generators.id, generatorId));

    // Create usage log entry
    await db.insert(schema.usageLogs).values({
      generatorId,
      startTime,
      endTime: now,
      durationHours,
    });

    return {
      status: 'stopped',
      isRunning: false,
      durationHours,
      totalHours: newTotalHours,
    };
  }
}

export async function getGeneratorByApiKey(apiKey: string) {
  const db = getDb();
  const keyHash = hashApiKey(apiKey);

  const [apiKeyRecord] = await db
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKeyRecord) {
    return null;
  }

  // Update last used timestamp
  await db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKeyRecord.id));

  // Get the user's generator (assuming one generator per user for MVP)
  const [generator] = await db
    .select()
    .from(schema.generators)
    .where(eq(schema.generators.userId, apiKeyRecord.userId))
    .limit(1);

  return generator;
}
