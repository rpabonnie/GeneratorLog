import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/auth.js';
import { sendPasswordResetEmail, sendMaintenanceAlertIfNeeded, sendEnrollmentAlertEmail, getEmailTransporter } from '../services/email.js';
import { createSession, deleteSession, sessionCookie, clearSessionCookie, parseCookies } from '../services/session.js';
import { applyRateLimit } from '../middleware/rate-limiter.js';
import config from '../config.js';

const enrollSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const confirmResetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

// Pre-computed dummy hash used to keep login timing constant when user is not found,
// preventing user enumeration via response-time differences.
const DUMMY_HASH = 'a'.repeat(32) + ':' + 'a'.repeat(128);

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/enroll', async (request, reply) => {
    const rateLimiter = (app as any).rateLimiter;
    if (rateLimiter && !applyRateLimit(request, reply, rateLimiter)) {
      return;
    }

    const validation = enrollSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { email, password, name } = validation.data;
    const db = getDb();

    try {
      const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await hashPassword(password);
      const [newUser] = await db
        .insert(schema.users)
        .values({ email, name: name || null, passwordHash })
        .returning();

      app.log.info({ security: 'enrollment', ip: request.ip, email }, 'New user enrolled');

      // Fire-and-forget owner notification — must not block or fail enrollment
      sendEnrollmentAlertEmail(newUser.email, newUser.name).catch(err => app.log.error(err));

      const sessionId = await createSession(newUser.id);
      return reply
        .status(201)
        .header('Set-Cookie', sessionCookie(sessionId))
        .send({ token: sessionId, id: newUser.id, email: newUser.email, name: newUser.name, createdAt: newUser.createdAt });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const rateLimiter = (app as any).rateLimiter;
    if (rateLimiter && !applyRateLimit(request, reply, rateLimiter)) {
      return;
    }

    const validation = loginSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { email, password } = validation.data;
    const db = getDb();

    try {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);

      // Always run scrypt even when user not found to prevent user enumeration via timing
      const passwordToCheck = user?.passwordHash ?? DUMMY_HASH;
      const isValid = await verifyPassword(password, passwordToCheck);

      if (!user || !isValid) {
        app.log.warn(
          { security: 'failed_login', ip: request.ip, email },
          'Rejected login with invalid credentials'
        );
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const sessionId = await createSession(user.id);

      // Fire-and-forget: check if any months threshold is overdue — completes after response is sent
      if (getEmailTransporter()) {
        db.select().from(schema.generators).where(eq(schema.generators.userId, user.id))
          .then(generators =>
            Promise.all(generators.map(gen =>
              sendMaintenanceAlertIfNeeded(user.email, {
                generatorName: gen.name,
                totalHours: gen.totalHours,
                lastOilChangeHours: gen.lastOilChangeHours,
                oilChangeHours: gen.oilChangeHours,
                lastOilChangeDate: gen.lastOilChangeDate,
                oilChangeMonths: gen.oilChangeMonths,
                installedAt: gen.installedAt,
              })
            ))
          )
          .catch(err => app.log.error(err));
      }

      return reply
        .header('Set-Cookie', sessionCookie(sessionId))
        .send({ token: sessionId, id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      await deleteSession(authHeader.slice(7));
    } else {
      const cookieHeader = request.headers['cookie'];
      if (cookieHeader) {
        const sessionId = parseCookies(cookieHeader)[config.session.cookieName];
        if (sessionId) await deleteSession(sessionId);
      }
    }
    return reply.header('Set-Cookie', clearSessionCookie()).status(204).send();
  });

  app.post('/api/auth/password/change', async (request, reply) => {
    const rateLimiter = (app as any).rateLimiter;
    if (rateLimiter && !applyRateLimit(request, reply, rateLimiter)) {
      return;
    }

    const userId = (request as any).sessionUser?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const validation = changePasswordSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { currentPassword, newPassword } = validation.data;
    const db = getDb();

    try {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      if (!user) return reply.status(404).send({ error: 'User not found' });

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) return reply.status(401).send({ error: 'Invalid password' });

      const passwordHash = await hashPassword(newPassword);
      await db.update(schema.users).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.users.id, userId));
      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/password-reset/request', async (request, reply) => {
    const rateLimiter = (app as any).rateLimiter;
    if (rateLimiter && !applyRateLimit(request, reply, rateLimiter)) {
      return;
    }

    const validation = requestResetSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    if (!config.appBaseUrl) {
      return reply.status(500).send({ error: 'Password reset is not configured' });
    }

    const { email } = validation.data;
    const db = getDb();

    try {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);

      if (user) {
        const token = randomBytes(32).toString('base64url');
        const tokenHash = hashResetToken(token);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

        await db.insert(schema.passwordResetTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        const resetUrl = `${config.appBaseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
        await sendPasswordResetEmail(user.email, user.name ?? 'there', resetUrl);
      }

      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/password-reset/confirm', async (request, reply) => {
    const rateLimiter = (app as any).rateLimiter;
    if (rateLimiter && !applyRateLimit(request, reply, rateLimiter)) {
      return;
    }

    const validation = confirmResetSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { token, password } = validation.data;
    const db = getDb();
    const now = new Date();
    const tokenHash = hashResetToken(token);

    try {
      const [resetToken] = await db
        .select()
        .from(schema.passwordResetTokens)
        .where(and(
          eq(schema.passwordResetTokens.tokenHash, tokenHash),
          gt(schema.passwordResetTokens.expiresAt, now),
          isNull(schema.passwordResetTokens.usedAt)
        ))
        .limit(1);

      if (!resetToken) {
        return reply.status(400).send({ error: 'Invalid or expired reset link' });
      }

      const passwordHash = await hashPassword(password);

      await db.update(schema.users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(schema.users.id, resetToken.userId));

      await db.update(schema.passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(schema.passwordResetTokens.id, resetToken.id));

      await db.delete(schema.sessions).where(eq(schema.sessions.userId, resetToken.userId));

      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = (request as any).sessionUser;
    if (!user) return reply.status(401).send({ error: 'Not authenticated' });
    return reply.send({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
  });
}
