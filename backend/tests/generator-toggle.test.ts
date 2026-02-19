import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerGeneratorRoutes } from '../src/routes/generator.js';
import { authRoutes } from '../src/routes/auth.js';
import { apiKeyRoutes } from '../src/routes/api-keys.js';
import { generatorConfigRoutes } from '../src/routes/generator-config.js';
import { registerSessionMiddleware } from '../src/services/session.js';
import { RateLimiter } from '../src/middleware/rate-limiter.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

const TEST_PASSWORD = 'TestPass123!';

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return header ? header.split(';')[0] : '';
}

describe('Generator Toggle Endpoint', () => {
  let app: FastifyInstance;
  let rateLimiter: RateLimiter;
  let testApiKey: string;

  beforeEach(async () => {
    app = Fastify();
    rateLimiter = new RateLimiter(1);
    app.decorate('rateLimiter', rateLimiter);

    registerSessionMiddleware(app);
    await authRoutes(app);
    await apiKeyRoutes(app);
    await generatorConfigRoutes(app);
    registerGeneratorRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();

    // Enroll user and capture session cookie (enroll auto-creates a session)
    const enrollResp = await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: { email: 'toggle@example.com', name: 'Toggle User', password: TEST_PASSWORD },
    });
    const cookie = extractCookie(enrollResp.headers['set-cookie']);

    // Create an API key — raw key is returned only once
    const keyResp = await app.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { cookie },
      payload: { name: 'Test Key' },
    });
    testApiKey = JSON.parse(keyResp.body).key;

    // Create a generator for the user
    await app.inject({
      method: 'POST',
      url: '/api/generators',
      headers: { cookie },
      payload: { name: 'Test Generator', oilChangeHours: 100, oilChangeMonths: 6 },
    });
  });

  afterEach(async () => {
    rateLimiter.destroy();
    await app.close();
  });

  it('starts a generator that is not running', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('started');
    expect(body.isRunning).toBe(true);
    expect(body.startTime).toBeDefined();
  });

  it('stops a generator that is running', async () => {
    // Start the generator
    await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    // Wait for rate limit to reset (1.1 seconds)
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Stop it
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('stopped');
    expect(body.isRunning).toBe(false);
    expect(body.durationHours).toBeGreaterThan(0);
  });

  it('requires an API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
    });

    expect(response.statusCode).toBe(401);
  });

  it('enforces rate limiting', async () => {
    // First request should succeed
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });
    expect(response1.statusCode).toBe(200);

    // Second request should be rate limited
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': testApiKey },
    });
    expect(response2.statusCode).toBe(429);
    const body = JSON.parse(response2.body);
    expect(body.error).toContain('rate limit');
  });

  it('returns 401 for an invalid API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: { 'x-api-key': 'gl_invalid_key_that_does_not_exist' },
    });

    expect(response.statusCode).toBe(401);
  });
});
