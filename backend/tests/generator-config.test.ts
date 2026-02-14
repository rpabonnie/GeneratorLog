import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { generatorConfigRoutes } from '../src/routes/generator-config.js';
import { authRoutes } from '../src/routes/auth.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

describe('Generator Configuration Routes', () => {
  let app: FastifyInstance;
  let testUserId: number;

  beforeEach(async () => {
    app = Fastify();
    await authRoutes(app);
    await generatorConfigRoutes(app);
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
        email: 'generator@example.com',
        name: 'Generator User',
      },
    });

    testUserId = JSON.parse(enrollResponse.body).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/generators', () => {
    it('should create a new generator', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: {
          'x-user-id': testUserId.toString(),
        },
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'My Generator',
        },
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid oil change values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'Generator',
          oilChangeHours: -10,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/generators',
        payload: {
          name: 'Generator',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/generators', () => {
    it('should return empty array when user has no generators', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/generators',
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual([]);
    });

    it('should return user generators', async () => {
      // Create a generator
      await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'Generator 1',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/generators',
        headers: {
          'x-user-id': testUserId.toString(),
        },
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'Test Generator',
        },
      });

      const generator = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generator.id}`,
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Test Generator');
    });

    it('should return 404 for non-existent generator', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/generators/99999',
        headers: {
          'x-user-id': testUserId.toString(),
        },
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'Old Name',
        },
      });

      const generator = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generator.id}`,
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'New Name',
          oilChangeMonths: 12,
          oilChangeHours: 200,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('New Name');
      expect(body.oilChangeMonths).toBe(12);
      expect(body.oilChangeHours).toBe(200);
    });

    it('should prevent user from updating another user generator', async () => {
      // Create second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'user2@example.com',
        },
      });

      const user2Id = JSON.parse(user2Response.body).id;

      // Create generator for user 1
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/generators',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'User 1 Generator',
        },
      });

      const generator = JSON.parse(createResponse.body);

      // Try to update as user 2
      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generator.id}`,
        headers: {
          'x-user-id': user2Id.toString(),
        },
        payload: {
          name: 'Hacked',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/generators/1',
        payload: {
          name: 'New Name',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
