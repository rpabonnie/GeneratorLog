import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerGeneratorRoutes } from '../src/routes/generator.js';
import { authRoutes } from '../src/routes/auth.js';
import { apiKeyRoutes } from '../src/routes/api-keys.js';
import { generatorConfigRoutes } from '../src/routes/generator-config.js';
import { oilChangeHistoryRoutes } from '../src/routes/oil-change-history.js';
import { registerSessionMiddleware } from '../src/services/session.js';
import { RateLimiter } from '../src/middleware/rate-limiter.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import * as emailService from '../src/services/email.js';
import { eq } from 'drizzle-orm';

const TEST_PASSWORD = 'TestPass123!';

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return header ? header.split(';')[0] : '';
}

describe('Oil Change Alert with Fresh Data', () => {
  let app: FastifyInstance;
  let rateLimiter: RateLimiter;
  let testApiKey: string;
  let testCookie: string;
  let generatorId: number;

  beforeEach(async () => {
    app = Fastify();
    rateLimiter = new RateLimiter(1);
    app.decorate('rateLimiter', rateLimiter);

    registerSessionMiddleware(app);
    await authRoutes(app);
    await apiKeyRoutes(app);
    await generatorConfigRoutes(app);
    await oilChangeHistoryRoutes(app);
    registerGeneratorRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.oilChangeHistory).execute();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();

    // Enroll user and capture session cookie
    const enrollResp = await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: { email: 'oilchange@example.com', name: 'Oil Change User', password: TEST_PASSWORD },
    });
    testCookie = extractCookie(enrollResp.headers['set-cookie']);

    // Create an API key
    const keyResp = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { cookie: testCookie },
      payload: { name: 'Test Key' },
    });
    testApiKey = JSON.parse(keyResp.body).key;

    // Create a generator with low thresholds for easy testing
    const genResp = await app.inject({
      method: 'POST',
      url: '/api/generators',
      headers: { cookie: testCookie },
      payload: { name: 'Test Generator', oilChangeHours: 10, oilChangeMonths: 6 },
    });
    generatorId = JSON.parse(genResp.body).id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    rateLimiter.destroy();
    await app.close();
  });

  it('should use fresh oil change data when sending maintenance alert after toggle', async () => {
    // Mock email service to capture what data is passed to it
    let capturedEmailData: any = null;
    const mockSendStopEmails = vi.spyOn(emailService, 'sendGeneratorStopEmails').mockImplementation(async (email, data) => {
      capturedEmailData = data;
    });

    // 1. Start generator
    await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    // Wait for rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 2. Stop generator (adds some hours)
    await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    // 3. Log an oil change at current hours
    await app.inject({
      method: 'POST',
      url: `/api/generators/${generatorId}/oil-changes`,
      headers: { cookie: testCookie },
      payload: { notes: 'Fresh oil change' },
    });

    // 4. Verify the generator was updated with fresh oil change data
    const db = getDb();
    const [generator] = await db
      .select()
      .from(schema.generators)
      .where(eq(schema.generators.id, generatorId))
      .limit(1);

    expect(generator.lastOilChangeDate).not.toBeNull();
    expect(generator.lastOilChangeHours).toBeGreaterThan(0);
    const oilChangeHoursAtReset = generator.lastOilChangeHours!;

    // Wait for rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 5. Start generator again
    await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    // Wait for rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 6. Stop generator again (this should trigger email with FRESH oil change data)
    await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    // 7. Verify email was sent with the correct (fresh) lastOilChangeHours
    expect(mockSendStopEmails).toHaveBeenCalled();
    expect(capturedEmailData).not.toBeNull();

    // The key assertion: email should use the lastOilChangeHours from after the oil change was logged,
    // not the stale value from before toggleGenerator was called
    expect(capturedEmailData.lastOilChangeHours).toBe(oilChangeHoursAtReset);
    expect(capturedEmailData.lastOilChangeDate).not.toBeNull();

    // Additional verification: the hours since oil change should be small (just the last run)
    // not the full generator lifetime
    const hoursSinceOilChange = capturedEmailData.totalHours - capturedEmailData.lastOilChangeHours;
    expect(hoursSinceOilChange).toBeLessThan(1); // Should be tiny, just milliseconds of runtime
  });
});
