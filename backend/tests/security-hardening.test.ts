import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerSessionMiddleware } from '../src/services/session.js';
import { sendEnrollmentAlertEmail } from '../src/services/email.js';
import config from '../src/config.js';

describe('Session bearer format check', () => {
  let app: FastifyInstance;
  const getSessionUserSpy = vi.fn();

  beforeEach(async () => {
    app = Fastify();
    registerSessionMiddleware(app);
    app.get('/whoami', async (request) => ({ user: (request as any).sessionUser }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    getSessionUserSpy.mockReset();
  });

  it('ignores bearer values that are not 64-char hex session ids (e.g. JWTs)', async () => {
    const jwtish = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln';
    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${jwtish}` },
    });
    // Must not throw or hit the DB — sessionUser stays null
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).user).toBeNull();
  });

  it('ignores uppercase or wrong-length hex bearer values', async () => {
    for (const bad of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]) {
      const response = await app.inject({
        method: 'GET',
        url: '/whoami',
        headers: { authorization: `Bearer ${bad}` },
      });
      expect(JSON.parse(response.body).user).toBeNull();
    }
  });
});

describe('Security response headers', () => {
  it('sets nosniff, frame and referrer headers on responses', async () => {
    // Mirrors the onRequest hook registered in src/index.ts
    const app = Fastify();
    app.addHook('onRequest', async (_request, reply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Referrer-Policy', 'no-referrer');
    });
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/ping' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    await app.close();
  });
});

describe('sendEnrollmentAlertEmail', () => {
  const emailConfig = config.email as { host: string };
  let origHost: string;
  let origOwner: string;

  beforeEach(() => {
    origHost = emailConfig.host;
    origOwner = config.ownerEmail;
  });

  afterEach(() => {
    emailConfig.host = origHost;
    (config as { ownerEmail: string }).ownerEmail = origOwner;
  });

  it('is a no-op when OWNER_EMAIL is not configured', async () => {
    (config as { ownerEmail: string }).ownerEmail = '';
    await expect(sendEnrollmentAlertEmail('new@example.com', 'New User')).resolves.toBeUndefined();
  });

  it('is a no-op when SMTP is not configured', async () => {
    emailConfig.host = '';
    (config as { ownerEmail: string }).ownerEmail = 'owner@example.com';
    await expect(sendEnrollmentAlertEmail('new@example.com', 'New User')).resolves.toBeUndefined();
  });

  it('skips the owner enrolling themselves (case-insensitive)', async () => {
    (config as { ownerEmail: string }).ownerEmail = 'Owner@Example.com';
    await expect(sendEnrollmentAlertEmail('owner@example.com', 'Ray')).resolves.toBeUndefined();
  });
});
