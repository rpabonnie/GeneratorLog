import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { emailRoutes } from '../src/routes/email.js';
import { authRoutes } from '../src/routes/auth.js';
import { generatorConfigRoutes } from '../src/routes/generator-config.js';
import { registerSessionMiddleware } from '../src/services/session.js';
import { getDb } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import * as emailService from '../src/services/email.js';

const TEST_PASSWORD = 'TestPass123!';

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return header ? header.split(';')[0] : '';
}

describe('Email Routes', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeEach(async () => {
    app = Fastify();

    registerSessionMiddleware(app);
    await authRoutes(app);
    await generatorConfigRoutes(app);
    await emailRoutes(app);
    await app.ready();

    const db = getDb();
    await db.delete(schema.generators).execute();
    await db.delete(schema.sessions).execute();
    await db.delete(schema.users).execute();

    const enrollResp = await app.inject({
      method: 'POST',
      url: '/api/auth/enroll',
      payload: { email: 'test@example.com', name: 'Test User', password: TEST_PASSWORD },
    });
    cookie = extractCookie(enrollResp.headers['set-cookie']);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  describe('POST /api/email/test', () => {
    it('sends a test email when user is authenticated and email service is configured', async () => {
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
      };
      vi.spyOn(emailService, 'getEmailTransporter').mockReturnValue(mockTransporter as any);
      vi.spyOn(emailService, 'sendTestEmail').mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/api/email/test',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('test@example.com');
      expect(emailService.sendTestEmail).toHaveBeenCalledWith('test@example.com', 'Test User');
    });

    it('returns 401 when user is not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/email/test',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not authenticated');
    });

    it('returns 503 when email service is not configured', async () => {
      vi.spyOn(emailService, 'getEmailTransporter').mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/email/test',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Email service not configured');
    });

    it('returns 500 when email sending fails', async () => {
      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(new Error('SMTP connection failed')),
      };
      vi.spyOn(emailService, 'getEmailTransporter').mockReturnValue(mockTransporter as any);
      vi.spyOn(emailService, 'sendTestEmail').mockRejectedValue(new Error('SMTP connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/email/test',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to send test email');
      expect(body.message).toContain('SMTP connection failed');
    });
  });
});
