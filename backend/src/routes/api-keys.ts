import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateApiKey } from '../utils/auth.js';

const createApiKeySchema = z.object({
  name: z.string().min(1).optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  app.post('/api/api-keys', async (request, reply) => {
    const userId = (request as any).sessionUser?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const validation = createApiKeySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const { name } = validation.data;
    const db = getDb();

    try {
      const { raw, hash, hint } = generateApiKey();

      const [newApiKey] = await db
        .insert(schema.apiKeys)
        .values({ userId, keyHash: hash, hint, name: name || null })
        .returning();

      // Return raw key exactly once — it cannot be recovered after this response
      return reply.status(201).send({
        id: newApiKey.id,
        name: newApiKey.name,
        key: raw,
        hint: newApiKey.hint,
        createdAt: newApiKey.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/api/api-keys', async (request, reply) => {
    const userId = (request as any).sessionUser?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const db = getDb();

    try {
      const apiKeys = await db
        .select()
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.userId, userId));

      return reply.send(apiKeys.map(k => ({
        id: k.id,
        name: k.name,
        hint: `gl_...${k.hint}`,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })));
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.delete('/api/api-keys/:id', async (request, reply) => {
    const userId = (request as any).sessionUser?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const params = request.params as { id: string };
    const keyId = parseInt(params.id, 10);
    if (isNaN(keyId)) return reply.status(400).send({ error: 'Invalid API key ID' });

    const db = getDb();

    try {
      const [existing] = await db
        .select()
        .from(schema.apiKeys)
        .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, userId)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: 'API key not found' });

      await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, keyId));
      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/api-keys/:id/reset', async (request, reply) => {
    const userId = (request as any).sessionUser?.id;
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const params = request.params as { id: string };
    const keyId = parseInt(params.id, 10);
    if (isNaN(keyId)) return reply.status(400).send({ error: 'Invalid API key ID' });

    const db = getDb();

    try {
      const [existing] = await db
        .select()
        .from(schema.apiKeys)
        .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, userId)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: 'API key not found' });

      const { raw, hash, hint } = generateApiKey();

      const [updated] = await db
        .update(schema.apiKeys)
        .set({ keyHash: hash, hint, lastUsedAt: null })
        .where(eq(schema.apiKeys.id, keyId))
        .returning();

      // Return raw key exactly once
      return reply.send({
        id: updated.id,
        name: updated.name,
        key: raw,
        hint: updated.hint,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
