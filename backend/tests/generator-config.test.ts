import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { generatorConfigRoutes } from '../src/routes/generator-config.js';
import { authRoutes } from '../src/routes/auth.js';
import { registerSessionMiddleware } from '../src/services/session.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

const TEST_PASSWORD = 'TestPass123!';

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return header ? header.split(';')[0] : '';
}

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const resp = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  return extractCookie(resp.headers['set-cookie']);
}

describe('Generator Configuration Routes', () => {
  let app: FastifyInstance;
  let testCookie: string;

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    await authRoutes(app);
    await generatorConfigRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();

    await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: { email: 'generator@example.com', name: 'Generator User', password: TEST_PASSWORD },
    });
    testCookie = await loginAs(app, 'generator@example.com');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/generators', () => {
    it('should create a new generator', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: {
          name: 'Honda EU2200i',
          oilChangeMonths: 6,
          oilChangeHours: 100,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Honda EU2200i');
      expect(body.oilChangeMonths).toBe(6);
      expect(body.oilChangeHours).toBe(100);
      expect(body.totalHours).toBe(0);
      expect(body.isRunning).toBe(false);
    });

    it('should create generator with default oil change settings', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'My Generator' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.oilChangeMonths).toBe(6);
      expect(body.oilChangeHours).toBe(100);
    });

    it('should reject creation without name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid oil change values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'Generator', oilChangeHours: -10 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        payload: { name: 'Generator' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/generators', () => {
    it('should return empty array when user has no generators', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/generators',
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return user generators', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'Generator 1' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/generators',
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Generator 1');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/generators',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/generators/:id', () => {
    it('should get generator by id', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'Test Generator' },
      });
      const generator = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generator.id}`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).name).toBe('Test Generator');
    });

    it('should return 404 for non-existent generator', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/generators/99999',
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/generators/1',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/generators/:id', () => {
    it('should update generator settings', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'Old Name' },
      });
      const generator = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generator.id}`,
        headers: { cookie: testCookie },
        payload: { name: 'New Name', oilChangeMonths: 12, oilChangeHours: 200 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('New Name');
      expect(body.oilChangeMonths).toBe(12);
      expect(body.oilChangeHours).toBe(200);
    });

    it('should prevent user from updating another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'user2@example.com', password: TEST_PASSWORD },
      });
      const user2Cookie = await loginAs(app, 'user2@example.com');

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'User 1 Generator' },
      });
      const generator = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generator.id}`,
        headers: { cookie: user2Cookie },
        payload: { name: 'Hacked' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/generators/1',
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/generators/:id/toggle', () => {
    let generatorId: number;

    beforeEach(async () => {
      const resp = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: { cookie: testCookie },
        payload: { name: 'Toggle Generator' },
      });
      generatorId = JSON.parse(resp.body).id;
    });

    it('should start a stopped generator', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/toggle`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('started');
      expect(body.isRunning).toBe(true);
      expect(body.startTime).toBeDefined();
    });

    it('should stop a running generator and create a usage log', async () => {
      // Start first
      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/toggle`,
        headers: { cookie: testCookie },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/toggle`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('stopped');
      expect(body.isRunning).toBe(false);
      expect(body.durationHours).toBeGreaterThanOrEqual(0);
      expect(body.totalHours).toBeGreaterThanOrEqual(0);
    });

    it('should return updated generator state after start', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/toggle`,
        headers: { cookie: testCookie },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });
      expect(JSON.parse(genResp.body).isRunning).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/toggle`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'toggle-other@example.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'toggle-other@example.com');

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/toggle`,
        headers: { cookie: otherCookie },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
