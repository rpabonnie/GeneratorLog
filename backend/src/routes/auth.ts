import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/auth.js';
import { createSession, deleteSession, sessionCookie, clearSessionCookie, parseCookies } from '../services/session.js';
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

// Pre-computed dummy hash used to keep login timing constant when user is not found,
// preventing user enumeration via response-time differences.
const DUMMY_HASH = 'a'.repeat(32) + ':' + 'a'.repeat(128);

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/enroll', async (request, reply) => {
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

      const sessionId = await createSession(newUser.id);
      return reply
        .status(201)
        .header('Set-Cookie', sessionCookie(sessionId))
        .send({ id: newUser.id, email: newUser.email, name: newUser.name, createdAt: newUser.createdAt });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
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
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      const sessionId = await createSession(user.id);
      return reply
        .header('Set-Cookie', sessionCookie(sessionId))
        .send({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const cookieHeader = request.headers['cookie'];
    if (cookieHeader) {
      const sessionId = parseCookies(cookieHeader)[config.session.cookieName];
      if (sessionId) await deleteSession(sessionId);
    }
    return reply.header('Set-Cookie', clearSessionCookie()).status(204).send();
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = (request as any).sessionUser;
    if (!user) return reply.status(401).send({ error: 'Not authenticated' });
    return reply.send({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
  });
}
