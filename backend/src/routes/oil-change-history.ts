import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const createOilChangeSchema = z.object({
  performedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

function getUserId(request: any): number | null {
  return (request.sessionUser?.id) ?? null;
}

async function resolveOwnerGenerator(
  db: ReturnType<typeof getDb>,
  generatorId: number,
  userId: number
) {
  const [generator] = await db
    .select()
    .from(schema.generators)
    .where(and(eq(schema.generators.id, generatorId), eq(schema.generators.userId, userId)))
    .limit(1);
  return generator ?? null;
}

async function syncGeneratorOilChangeFields(
  db: ReturnType<typeof getDb>,
  generatorId: number
): Promise<void> {
  const [latest] = await db
    .select()
    .from(schema.oilChangeHistory)
    .where(eq(schema.oilChangeHistory.generatorId, generatorId))
    .orderBy(desc(schema.oilChangeHistory.performedAt))
    .limit(1);

  await db
    .update(schema.generators)
    .set({
      lastOilChangeDate: latest?.performedAt ?? null,
      lastOilChangeHours: latest?.hoursAtChange ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.generators.id, generatorId));
}

export async function oilChangeHistoryRoutes(app: FastifyInstance) {
  app.get('/api/generators/:id/oil-changes', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const generatorId = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(generatorId)) return reply.status(400).send({ error: 'Invalid generator ID' });

    const db = getDb();
    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    try {
      const entries = await db
        .select()
        .from(schema.oilChangeHistory)
        .where(eq(schema.oilChangeHistory.generatorId, generatorId))
        .orderBy(desc(schema.oilChangeHistory.performedAt));

      return reply.send(entries.map(e => ({
        id: e.id,
        generatorId: e.generatorId,
        performedAt: e.performedAt,
        hoursAtChange: e.hoursAtChange,
        notes: e.notes,
        createdAt: e.createdAt,
      })));
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/generators/:id/oil-changes', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const generatorId = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(generatorId)) return reply.status(400).send({ error: 'Invalid generator ID' });

    const validation = createOilChangeSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const db = getDb();
    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    const { performedAt, notes } = validation.data;

    try {
      const [entry] = await db
        .insert(schema.oilChangeHistory)
        .values({
          generatorId,
          performedAt: performedAt ? new Date(performedAt) : new Date(),
          hoursAtChange: generator.totalHours,
          notes: notes ?? null,
        })
        .returning();

      await syncGeneratorOilChangeFields(db, generatorId);

      return reply.status(201).send({
        id: entry.id,
        generatorId: entry.generatorId,
        performedAt: entry.performedAt,
        hoursAtChange: entry.hoursAtChange,
        notes: entry.notes,
        createdAt: entry.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.delete('/api/generators/:id/oil-changes/:changeId', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const params = request.params as { id: string; changeId: string };
    const generatorId = parseInt(params.id, 10);
    const changeId = parseInt(params.changeId, 10);

    if (isNaN(generatorId) || isNaN(changeId)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    const db = getDb();
    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    const [existing] = await db
      .select()
      .from(schema.oilChangeHistory)
      .where(and(
        eq(schema.oilChangeHistory.id, changeId),
        eq(schema.oilChangeHistory.generatorId, generatorId)
      ))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: 'Oil change entry not found' });

    try {
      await db.delete(schema.oilChangeHistory).where(eq(schema.oilChangeHistory.id, changeId));
      await syncGeneratorOilChangeFields(db, generatorId);
      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
