import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { apiKeyRoutes } from '../src/routes/api-keys.js';
import { authRoutes } from '../src/routes/auth.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';

describe('API Key Routes', () => {
  let app: FastifyInstance;
  let testUserId: number;

  beforeEach(async () => {
    app = Fastify();
    await authRoutes(app);
    await apiKeyRoutes(app);
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
        email: 'apikey@example.com',
        name: 'API Key User',
      },
    });

    testUserId = JSON.parse(enrollResponse.body).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key with name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'iPhone Shortcut',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('iPhone Shortcut');
      expect(body.key).toBeDefined();
      expect(body.key).toHaveLength(64);
      expect(body).toHaveProperty('createdAt');
    });

    it('should create API key without name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBeNull();
      expect(body.key).toHaveLength(64);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        payload: {
          name: 'Key',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/api-keys', () => {
    it('should return empty array when user has no API keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual([]);
    });

    it('should return user API keys without showing full key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'Test Key',
        },
      });

      const createdKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Test Key');
      expect(body[0].keyPreview).toBe(createdKey.key.substring(0, 8) + '...');
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
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'To Delete',
        },
      });

      const apiKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/api-keys/${apiKey.id}`,
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify it's deleted
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      const keys = JSON.parse(listResponse.body);
      expect(keys).toHaveLength(0);
    });

    it('should prevent deleting another users API key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'User 1 Key',
        },
      });

      const apiKey = JSON.parse(createResponse.body);

      // Create second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'user2@example.com',
        },
      });

      const user2Id = JSON.parse(user2Response.body).id;

      // Try to delete as user 2
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/api-keys/${apiKey.id}`,
        headers: {
          'x-user-id': user2Id.toString(),
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/api-keys/99999',
        headers: {
          'x-user-id': testUserId.toString(),
        },
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
    it('should reset an API key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'To Reset',
        },
      });

      const originalKey = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/api-keys/${originalKey.id}/reset`,
        headers: {
          'x-user-id': testUserId.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key).toBeDefined();
      expect(body.key).toHaveLength(64);
      expect(body.key).not.toBe(originalKey.key);
      expect(body.name).toBe('To Reset');
    });

    it('should prevent resetting another users API key', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          'x-user-id': testUserId.toString(),
        },
        payload: {
          name: 'User 1 Key',
        },
      });

      const apiKey = JSON.parse(createResponse.body);

      // Create second user
      const user2Response = await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: {
          email: 'user2@example.com',
        },
      });

      const user2Id = JSON.parse(user2Response.body).id;

      // Try to reset as user 2
      const response = await app.inject({
        method: 'POST',
        url: `/api/api-keys/${apiKey.id}/reset`,
        headers: {
          'x-user-id': user2Id.toString(),
        },
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
});
