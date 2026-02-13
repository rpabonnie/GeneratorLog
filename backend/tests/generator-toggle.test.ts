import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerGeneratorRoutes } from '../src/routes/generator.js';
import { RateLimiter } from '../src/middleware/rate-limiter.js';

describe('Generator Toggle Endpoint', () => {
  let app: FastifyInstance;
  let rateLimiter: RateLimiter;

  beforeEach(async () => {
    app = Fastify();
    rateLimiter = new RateLimiter(1);
    
    // Mock database for testing
    const mockDb = {
      generators: new Map(),
      usageLogs: [],
    };
    
    app.decorate('db', mockDb);
    app.decorate('rateLimiter', rateLimiter);
    
    registerGeneratorRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    rateLimiter.destroy();
    await app.close();
  });

  it('starts a generator that is not running', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {
        generatorId: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('started');
    expect(body.isRunning).toBe(true);
    expect(body.startTime).toBeDefined();
  });

  it('stops a generator that is running', async () => {
    // First, start the generator
    await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {
        generatorId: 1,
      },
    });

    // Wait for rate limit to reset (1.1 seconds)
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Then stop it
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {
        generatorId: 1,
      },
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
      payload: {
        generatorId: 1,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('enforces rate limiting', async () => {
    // First request should succeed
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {
        generatorId: 1,
      },
    });

    expect(response1.statusCode).toBe(200);

    // Second request should be rate limited
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {
        generatorId: 1,
      },
    });

    expect(response2.statusCode).toBe(429);
    const body = JSON.parse(response2.body);
    expect(body.error).toContain('rate limit');
  });

  it('validates generator ID is provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for non-existent generator', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/generator/toggle',
      headers: {
        'x-api-key': 'test-api-key',
      },
      payload: {
        generatorId: 999,
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
