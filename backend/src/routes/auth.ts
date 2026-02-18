import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

const enrollSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/enroll', async (request, reply) => {
    const validation = enrollSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { email, name } = validation.data;
    const db = getDb();

    try {
      // Check if user already exists
      const existingUsers = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existingUsers.length > 0) {
        return reply.status(409).send({
          error: 'Email already registered',
        });
      }

      // Create new user
      const [newUser] = await db
        .insert(schema.users)
        .values({
          email,
          name: name || null,
        })
        .returning();

      return reply.status(201).send({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    // Temporary implementation using x-user-id header
    // Will be replaced with proper session middleware
    const userId = request.headers['x-user-id'];

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const db = getDb();

    try {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, parseInt(userId as string, 10)))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          error: 'User not found',
        });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const validation = loginSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { email } = validation.data;
    const db = getDb();

    try {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          error: 'No account found for that email',
        });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
}
