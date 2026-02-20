import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { oilChangeHistoryRoutes } from '../src/routes/oil-change-history.js';
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

describe('Oil Change History Routes', () => {
  let app: FastifyInstance;
  let testCookie: string;
  let generatorId: number;

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    await authRoutes(app);
    await generatorConfigRoutes(app);
    await oilChangeHistoryRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.oilChangeHistory).execute();
    await db.delete(schema.usageLogs).execute();
    await db.delete(schema.apiKeys).execute();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();

    await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: { email: 'oilchange@example.com', name: 'Oil User', password: TEST_PASSWORD },
    });
    testCookie = await loginAs(app, 'oilchange@example.com');

    const genResp = await app.inject({
      method: 'POST',
      url: '/api/generators',
      headers: { cookie: testCookie },
      payload: { name: 'Test Generator', oilChangeHours: 100, oilChangeMonths: 6 },
    });
    generatorId = JSON.parse(genResp.body).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/generators/:id/oil-changes', () => {
    it('should return empty array when no oil changes logged', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return oil changes ordered by performedAt descending', async () => {
      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: { performedAt: new Date(Date.UTC(2025, 0, 1)).toISOString() },
      });
      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: { performedAt: new Date(Date.UTC(2025, 6, 1)).toISOString() },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);
      expect(new Date(body[0].performedAt) > new Date(body[1].performedAt)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/oil-changes`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other@oilchange.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other@oilchange.com');

      const response = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: otherCookie },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/generators/:id/oil-changes', () => {
    it('should create oil change with custom performedAt and notes', async () => {
      const performedAt = new Date(Date.UTC(2026, 0, 10)).toISOString();

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: { performedAt, notes: 'Used synthetic 5W-30' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.generatorId).toBe(generatorId);
      expect(body.notes).toBe('Used synthetic 5W-30');
    });

    it('should create oil change with default performedAt (now)', async () => {
      const before = new Date();

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: {},
      });

      const after = new Date();
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const performedAt = new Date(body.performedAt);
      expect(performedAt >= before).toBe(true);
      expect(performedAt <= after).toBe(true);
    });

    it('should update generator lastOilChangeDate and lastOilChangeHours', async () => {
      const performedAt = new Date(Date.UTC(2026, 0, 10)).toISOString();

      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: { performedAt },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });
      const gen = JSON.parse(genResp.body);
      expect(gen.lastOilChangeDate).not.toBeNull();
      expect(gen.lastOilChangeHours).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other2@oilchange.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other2@oilchange.com');

      const response = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: otherCookie },
        payload: {},
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/generators/:id/oil-changes/:changeId', () => {
    let changeId: number;

    beforeEach(async () => {
      const resp = await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: { performedAt: new Date(Date.UTC(2026, 0, 10)).toISOString() },
      });
      changeId = JSON.parse(resp.body).id;
    });

    it('should delete an oil change entry', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/oil-changes/${changeId}`,
        headers: { cookie: testCookie },
      });

      expect(response.statusCode).toBe(204);

      const listResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
      });
      expect(JSON.parse(listResp.body)).toHaveLength(0);
    });

    it('should revert generator lastOilChangeDate to previous entry after delete', async () => {
      // Add an older entry first
      await app.inject({
        method: 'POST',
        url: `/api/generators/${generatorId}/oil-changes`,
        headers: { cookie: testCookie },
        payload: { performedAt: new Date(Date.UTC(2025, 5, 1)).toISOString() },
      });

      // Delete the newer entry
      await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/oil-changes/${changeId}`,
        headers: { cookie: testCookie },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });
      const gen = JSON.parse(genResp.body);
      // Should now point to the older entry
      const lastDate = new Date(gen.lastOilChangeDate);
      expect(lastDate.getUTCFullYear()).toBe(2025);
      expect(lastDate.getUTCMonth()).toBe(5);
    });

    it('should set lastOilChangeDate to null when all entries deleted', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/oil-changes/${changeId}`,
        headers: { cookie: testCookie },
      });

      const genResp = await app.inject({
        method: 'GET',
        url: `/api/generators/${generatorId}`,
        headers: { cookie: testCookie },
      });
      const gen = JSON.parse(genResp.body);
      expect(gen.lastOilChangeDate).toBeNull();
    });

    it('should return 404 for non-existent entry', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/oil-changes/99999`,
        headers: { cookie: testCookie },
      });
      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/oil-changes/${changeId}`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for another user generator', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/enroll',
        payload: { email: 'other3@oilchange.com', password: TEST_PASSWORD },
      });
      const otherCookie = await loginAs(app, 'other3@oilchange.com');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/generators/${generatorId}/oil-changes/${changeId}`,
        headers: { cookie: otherCookie },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
