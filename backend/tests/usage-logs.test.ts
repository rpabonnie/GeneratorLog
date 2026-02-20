import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { usageLogsRoutes } from '../src/routes/usage-logs.js';
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

describe('Usage Logs Routes', () => {
  let app: FastifyInstance;
  let testCookie: string;
  let generatorId: number;

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    await authRoutes(app);
    await generatorConfigRoutes(app);
    await usageLogsRoutes(app);
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
      payload: { email: 'logs@example.com', name: 'Log User', password: TEST_PASSWORD },
    });
    testCookie = await loginAs(app, 'logs@example.com');

    const genResp = await app.inject({
      method: 'POST',
      url: '/api/generators',
      headers: { cookie: testCookie },
      payload: { name: 'Test Generator' },
    });
    generatorId = JSON.parse(genResp.body).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/generators/:id/logs', () => {
    it('should return empty array when generator has no logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return logs for the generator', async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 10, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString();

      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime, endTime },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].durationHours).toBeCloseTo(2, 5);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/logs`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other@example.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other@example.com');

      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: otherCookie },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/generators/:id/logs', () => {
    it('should create a log entry with startTime and endTime', async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(2026, 0, 1, 10, 30, 0)).toISOString();

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime, endTime },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.generatorId).toBe(generatorId);
      expect(body.durationHours).toBeCloseTo(2.5, 5);
    });

    it('should create a log entry with only startTime', async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.endTime).toBeNull();
      expect(body.durationHours).toBeNull();
    });

    it('should update generator totalHours after creating a completed log', async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(2026, 0, 1, 11, 0, 0)).toISOString();

      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime, endTime },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });

      expect(JSON.parse(genResp.body).totalHours).toBeCloseTo(3, 5);
    });

    it('should reject if endTime is before startTime', async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 10, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime, endTime },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject missing startTime', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { endTime: new Date().toISOString() },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        payload: { startTime: new Date().toISOString() },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other2@example.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other2@example.com');

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: otherCookie },
        payload: { startTime: new Date().toISOString() },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/generators/:id/logs/:logId', () => {
    let logId: number;

    beforeEach(async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();
      const logResp = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime },
      });
      logId = JSON.parse(logResp.body).id;
    });

    it('should update startTime and endTime', async () => {
      const newStartTime = new Date(Date.UTC(2026, 0, 1, 9, 0, 0)).toISOString();
      const newEndTime = new Date(Date.UTC(2026, 0, 1, 11, 0, 0)).toISOString();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: testCookie },
        payload: { startTime: newStartTime, endTime: newEndTime },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.durationHours).toBeCloseTo(2, 5);
    });

    it('should recalculate generator totalHours after update', async () => {
      const newStartTime = new Date(Date.UTC(2026, 0, 1, 9, 0, 0)).toISOString();
      const newEndTime = new Date(Date.UTC(2026, 0, 1, 13, 0, 0)).toISOString();

      await app.inject({
        method: 'PUT',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: testCookie },
        payload: { startTime: newStartTime, endTime: newEndTime },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });

      expect(JSON.parse(genResp.body).totalHours).toBeCloseTo(4, 5);
    });

    it('should reject if endTime is before startTime', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: testCookie },
        payload: {
          startTime: new Date(Date.UTC(2026, 0, 1, 10, 0, 0)).toISOString(),
          endTime: new Date(Date.UTC(2026, 0, 1, 9, 0, 0)).toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent log', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generatorId}/logs/99999`,
        headers: { cookie: testCookie },
        payload: { startTime: new Date().toISOString() },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        payload: { startTime: new Date().toISOString() },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other3@example.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other3@example.com');

      const response = await app.inject({
        method: 'PUT',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: otherCookie },
        payload: { startTime: new Date().toISOString() },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/generators/:id/logs/:logId', () => {
    let logId: number;

    beforeEach(async () => {
      const startTime = new Date(Date.UTC(2026, 0, 1, 8, 0, 0)).toISOString();
      const endTime = new Date(Date.UTC(2026, 0, 1, 10, 0, 0)).toISOString();
      const logResp = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
        payload: { startTime, endTime },
      });
      logId = JSON.parse(logResp.body).id;
    });

    it('should delete a log entry', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(204);

      const listResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/logs`,
        headers: { cookie: testCookie },
      });
      expect(JSON.parse(listResp.body)).toHaveLength(0);
    });

    it('should update generator totalHours after deleting a log', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: testCookie },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });

      expect(JSON.parse(genResp.body).totalHours).toBe(0);
    });

    it('should return 404 for non-existent log', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/logs/99999`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/logs/${logId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other4@example.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other4@example.com');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/logs/${logId}`,
        headers: { cookie: otherCookie },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
