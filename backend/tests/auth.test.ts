import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from '../src/routes/auth.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await authRoutes(app);
    await app.ready();

    // Clean up test data before each test
    const db = getDb();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.users).execute();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/auth/enroll', () => {
    it('should enroll a new user with email and name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.email).toBe('test@example.com');
      expect(body.name).toBe('Test User');
      expect(body).toHaveProperty('createdAt');
    });

    it('should enroll a user with email only (name optional)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'test2@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('test2@example.com');
      expect(body.name).toBeNull();
    });

    it('should reject enrollment with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
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
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'duplicate@example.com',
          name: 'Second User',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Email already registered');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      // First enroll a user
      const enrollResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'me@example.com',
          name: 'Me User',
        },
      });

      const user = JSON.parse(enrollResponse.body);

      // Mock session (we'll implement this properly with session middleware)
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          'x-user-id': user.id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('me@example.com');
      expect(body.name).toBe('Me User');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
