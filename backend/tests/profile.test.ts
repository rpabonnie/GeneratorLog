import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { profileRoutes } from '../src/routes/profile.js';
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

describe('Profile Routes', () => {
  let app: FastifyInstance;
  let testCookie: string;

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    await authRoutes(app);
    await profileRoutes(app);
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
      payload: { email: 'profile@example.com', name: 'Profile User', password: TEST_PASSWORD },
    });
    testCookie = await loginAs(app, 'profile@example.com');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/profile', () => {
    it('should get user profile with authenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/profile',
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('profile@example.com');
      expect(body.name).toBe('Profile User');
      expect(body).toHaveProperty('createdAt');
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/profile',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/profile', () => {
    it('should update user name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: { cookie: testCookie },
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
      expect(body.email).toBe('profile@example.com');
    });

    it('should update email', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: { cookie: testCookie },
        payload: { email: 'newemail@example.com' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('newemail@example.com');
    });

    it('should update both name and email', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: { cookie: testCookie },
        payload: { name: 'New Name', email: 'new@example.com' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('New Name');
      expect(body.email).toBe('new@example.com');
    });

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: { cookie: testCookie },
        payload: { email: 'not-an-email' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate email', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'existing@example.com', password: TEST_PASSWORD },
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: { cookie: testCookie },
        payload: { email: 'existing@example.com' },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Email already in use');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
