import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { profileRoutes } from '../src/routes/profile.js';
import { authRoutes } from '../src/routes/auth.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

describe('Profile Routes', () => {
  let app: FastifyInstance;
  let testUserId: number;

  beforeEach(async () => {
    app = Fastify();
    await authRoutes(app);
    await profileRoutes(app);
    await app.ready();

    // Clean up test data (order matters due to foreign keys)
    const db = getDb();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.users).execute();

    // Create a test user
    const enrollResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: {
        email: 'profile@example.com',
        name: 'Profile User',
      },
    });

    testUserId = JSON.parse(enrollResponse.body).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/profile', () => {
    it('should get user profile with authenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/profile',
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('profile@example.com');
      expect(body.name).toBe('Profile User');
      expect(body).toHaveProperty('createdAt');
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'Updated Name',
        },
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          email: 'newemail@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('newemail@example.com');
    });

    it('should update both name and email', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'New Name',
          email: 'new@example.com',
        },
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          email: 'not-an-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate email', async () => {
      // Create another user
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'existing@example.com',
        },
      });

      // Try to update to existing email
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          email: 'existing@example.com',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Email already in use');
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
