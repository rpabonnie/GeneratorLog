import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { apiKeyRoutes } from '../src/routes/api-keys.js';
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

describe('API Key Routes', () => {
  let app: FastifyInstance;
  let testCookie: string;

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    await authRoutes(app);
    await apiKeyRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();

    // Create and login test user
    await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: { email: 'apikey@example.com', name: 'API Key User', password: TEST_PASSWORD },
    });
    testCookie = await loginAs(app, 'apikey@example.com');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key with name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'iPhone Shortcut' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('iPhone Shortcut');
      // Raw key shown once: gl_ prefix + 43 base64url chars = 46 chars total
      expect(body.key).toBeDefined();
      expect(body.key).toMatch(/^gl_/);
      expect(body.key).toHaveLength(46);
      // hint is the last 4 chars of the raw key
      expect(body.hint).toBe(body.key.slice(-4));
      expect(body).toHaveProperty('createdAt');
    });

    it('should create API key without name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBeNull();
      expect(body.key).toHaveLength(46);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        payload: { name: 'Key' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/api-keys', () => {
    it('should return empty array when user has no API keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return user API keys with hint preview (full key not exposed)', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'Test Key' },
      });
      const createdKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Test Key');
      // List shows gl_... + last 4 chars, never the full key
      expect(body[0].hint).toBe(`gl_...${createdKey.key.slice(-4)}`);
      expect(body[0].key).toBeUndefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete an API key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'To Delete' },
      });
      const apiKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/api-keys/${apiKey.id}`,
        headers: { cookie: testCookie },
      });
      expect(response.statusCode).toBe(204);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
      });
      expect(JSON.parse(listResponse.body)).toHaveLength(0);
    });

    it('should prevent deleting another users API key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'User 1 Key' },
      });
      const apiKey = JSON.parse(createResponse.body);

      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'user2@example.com', password: TEST_PASSWORD },
      });
      const user2Cookie = await loginAs(app, 'user2@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/api-keys/${apiKey.id}`,
        headers: { cookie: user2Cookie },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/api-keys/99999',
        headers: { cookie: testCookie },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/api-keys/1',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/api-keys/:id/reset', () => {
    it('should reset an API key and return new raw key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'To Reset' },
      });
      const originalKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/api-keys/${originalKey.id}/reset`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key).toBeDefined();
      expect(body.key).toMatch(/^gl_/);
      expect(body.key).toHaveLength(46);
      expect(body.key).not.toBe(originalKey.key);
      expect(body.name).toBe('To Reset');
      expect(body.hint).toBe(body.key.slice(-4));
    });

    it('should prevent resetting another users API key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'User 1 Key' },
      });
      const apiKey = JSON.parse(createResponse.body);

      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'user2@example.com', password: TEST_PASSWORD },
      });
      const user2Cookie = await loginAs(app, 'user2@example.com');

      const response = await app.inject({
        method: 'POST',
        url: `/api/api-keys/${apiKey.id}/reset`,
        headers: { cookie: user2Cookie },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys/1/reset',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/api-keys/:id/qrcode', () => {
    it('should return QR code data URL and setup URL', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'QR Test Key' },
      });
      const apiKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/api-keys/${apiKey.id}/qrcode`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.qrCode).toBeDefined();
      expect(body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(body.shortcutFileUrl).toBeDefined();
      expect(body.shortcutFileUrl).toContain(`/api/api-keys/${apiKey.id}/shortcut-file`);
    });

    it('should prevent accessing another users API key QR code', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'User 1 Key' },
      });
      const apiKey = JSON.parse(createResponse.body);

      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'user2@example.com', password: TEST_PASSWORD },
      });
      const user2Cookie = await loginAs(app, 'user2@example.com');

      const response = await app.inject({
        method: 'GET',
        url: `/api/api-keys/${apiKey.id}/qrcode`,
        headers: { cookie: user2Cookie },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys/1/qrcode',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/api-keys/:id/shortcut-info', () => {
    it('should return shortcut setup information without exposing raw key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'Shortcut Info Test' },
      });
      const apiKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/api-keys/${apiKey.id}/shortcut-info`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(apiKey.id);
      expect(body.name).toBe('Shortcut Info Test');
      expect(body.hint).toMatch(/^gl_\.\.\./);
      expect(body.apiEndpoint).toBeDefined();
      expect(body.apiEndpoint).toContain('/api/generator/toggle');
      // Ensure raw key is not exposed
      expect(body.key).toBeUndefined();
    });

    it('should prevent accessing another users API key info', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: { cookie: testCookie },
        payload: { name: 'User 1 Key' },
      });
      const apiKey = JSON.parse(createResponse.body);

      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'user3@example.com', password: TEST_PASSWORD },
      });
      const user3Cookie = await loginAs(app, 'user3@example.com');

      const response = await app.inject({
        method: 'GET',
        url: `/api/api-keys/${apiKey.id}/shortcut-info`,
        headers: { cookie: user3Cookie },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys/1/shortcut-info',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
