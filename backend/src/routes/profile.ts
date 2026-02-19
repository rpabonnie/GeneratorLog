import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and, ne } from 'drizzle-orm';

const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
}).refine(data => data.name !== undefined || data.email !== undefined, {
  message: 'At least one field (name or email) must be provided',
});

function getUserId(request: any): number | null {
  return (request.sessionUser?.id) ?? null;
}

export async function profileRoutes(app: FastifyInstance) {
  app.get('/api/profile', async (request, reply) => {
    const userId = getUserId(request);

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
        .where(eq(schema.users.id, userId))
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

  app.put('/api/profile', async (request, reply) => {
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const validation = updateProfileSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { name, email } = validation.data;
    const db = getDb();

    try {
      // If email is being updated, check if it's already in use by another user
      if (email) {
        const [existingUser] = await db
          .select()
          .from(schema.users)
          .where(and(
            eq(schema.users.email, email),
            ne(schema.users.id, userId)
          ))
          .limit(1);

        if (existingUser) {
          return reply.status(409).send({
            error: 'Email already in use',
          });
        }
      }

      // Build update object
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      updateData.updatedAt = new Date();

      // Update user
      const [updatedUser] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, userId))
        .returning();

      if (!updatedUser) {
        return reply.status(404).send({
          error: 'User not found',
        });
      }

      return reply.send({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
}
