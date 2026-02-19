import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from '../src/routes/auth.js';
import { registerSessionMiddleware } from '../src/services/session.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

const TEST_PASSWORD = 'TestPass123!';

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return header ? header.split(';')[0] : '';
}

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    await authRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/auth/enroll', () => {
    it('should enroll a new user with email, password and name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.email).toBe('test@example.com');
      expect(body.name).toBe('Test User');
      expect(body).toHaveProperty('createdAt');
      expect(body).not.toHaveProperty('passwordHash');
      // Should set a session cookie on enroll
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should enroll a user with email and password only (name optional)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'test2@example.com',
          password: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('test2@example.com');
      expect(body.name).toBeNull();
    });

    it('should reject enrollment with missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject enrollment with password shorter than 8 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'test@example.com',
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject enrollment with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          password: TEST_PASSWORD,
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should reject enrollment with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'not-an-email',
          password: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate email enrollment', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'duplicate@example.com',
          name: 'First User',
          password: TEST_PASSWORD,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'duplicate@example.com',
          name: 'Second User',
          password: TEST_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'login@example.com', name: 'Login User', password: TEST_PASSWORD },
      });
    });

    it('should login with valid credentials and set session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'login@example.com', password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('login@example.com');
      expect(body).not.toHaveProperty('passwordHash');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'login@example.com', password: 'WrongPassword!' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for unknown email (same message as wrong password)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nobody@example.com', password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      // Must not reveal whether the email exists
      expect(body.error).toBe('Invalid email or password');
    });

    it('should return same error for wrong password (no user enumeration)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'login@example.com', password: 'WrongPassword!' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid email or password');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should delete the session and clear the cookie', async () => {
      const enrollResp = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'logout@example.com', password: TEST_PASSWORD },
      });
      const cookie = extractCookie(enrollResp.headers['set-cookie']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(204);
      // Cookie should be cleared (Max-Age=0)
      const setCookie = response.headers['set-cookie'] as string | string[];
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie ?? '';
      expect(cookieStr).toMatch(/Max-Age=0/);

      // /me should now return 401
      const meResp = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });
      expect(meResp.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated via session cookie', async () => {
      const enrollResp = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'me@example.com', name: 'Me User', password: TEST_PASSWORD },
      });
      const cookie = extractCookie(enrollResp.headers['set-cookie']);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('me@example.com');
      expect(body.name).toBe('Me User');
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user after login (not just enroll)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'me2@example.com', name: 'Me2', password: TEST_PASSWORD },
      });
      const loginResp = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'me2@example.com', password: TEST_PASSWORD },
      });
      const cookie = extractCookie(loginResp.headers['set-cookie']);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('me2@example.com');
    });
  });
});
