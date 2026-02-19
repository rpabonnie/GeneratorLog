import type { FastifyInstance } from 'fastify';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { generateSessionId } from '../utils/auth.js';
import config from '../config.js';

export function parseCookies(header: string): Record<string, string> {
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return acc;
    acc[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    return acc;
  }, {} as Record<string, string>);
}

export function sessionCookie(id: string): string {
  const maxAgeSeconds = Math.floor(config.session.maxAge / 1000);
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `${config.session.cookieName}=${id}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  const secure = config.nodeEnv === 'production' ? '; Secure' : '';
  return `${config.session.cookieName}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function createSession(userId: number): Promise<string> {
  const db = getDb();
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + config.session.maxAge);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });
  return id;
}

export async function getSessionUser(sessionId: string) {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  return row?.user ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export function registerSessionMiddleware(app: FastifyInstance): void {
  app.decorateRequest('sessionUser', null);
  app.addHook('onRequest', async (request) => {
    const cookieHeader = request.headers['cookie'];
    if (!cookieHeader) return;
    const sessionId = parseCookies(cookieHeader)[config.session.cookieName];
    if (!sessionId) return;
    (request as any).sessionUser = await getSessionUser(sessionId);
  });
}
