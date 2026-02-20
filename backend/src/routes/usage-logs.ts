import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and, sum } from 'drizzle-orm';

const createLogSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
}).refine(data => !data.endTime || new Date(data.endTime) > new Date(data.startTime), {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});

const updateLogSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().nullable().optional(),
}).refine(data => {
  if (data.startTime && data.endTime) {
    return new Date(data.endTime) > new Date(data.startTime);
  }
  return true;
}, {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});

function getUserId(request: any): number | null {
  return (request.sessionUser?.id) ?? null;
}

async function recalculateTotalHours(db: ReturnType<typeof getDb>, generatorId: number): Promise<void> {
  const result = await db
    .select({ total: sum(schema.usageLogs.durationHours) })
    .from(schema.usageLogs)
    .where(eq(schema.usageLogs.generatorId, generatorId));

  const totalHours = Number(result[0]?.total ?? 0);

  await db
    .update(schema.generators)
    .set({ totalHours, updatedAt: new Date() })
    .where(eq(schema.generators.id, generatorId));
}

async function resolveOwnerGenerator(
  db: ReturnType<typeof getDb>,
  generatorId: number,
  userId: number
) {
  const [generator] = await db
    .select()
    .from(schema.generators)
    .where(and(
      eq(schema.generators.id, generatorId),
      eq(schema.generators.userId, userId)
    ))
    .limit(1);
  return generator ?? null;
}

function calcDurationHours(startTime: string, endTime: string): number {
  return (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000;
}

export async function usageLogsRoutes(app: FastifyInstance) {
  app.get('/api/generators/:id/logs', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const generatorId = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(generatorId)) return reply.status(400).send({ error: 'Invalid generator ID' });

    const db = getDb();

    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    try {
      const logs = await db
        .select()
        .from(schema.usageLogs)
        .where(eq(schema.usageLogs.generatorId, generatorId))
        .orderBy(schema.usageLogs.startTime);

      return reply.send(logs.map(l => ({
        id: l.id,
        generatorId: l.generatorId,
        startTime: l.startTime,
        endTime: l.endTime,
        durationHours: l.durationHours,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })));
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/api/generators/:id/logs', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const generatorId = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(generatorId)) return reply.status(400).send({ error: 'Invalid generator ID' });

    const validation = createLogSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const db = getDb();
    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    const { startTime, endTime } = validation.data;
    const durationHours = endTime ? calcDurationHours(startTime, endTime) : null;

    try {
      const [log] = await db
        .insert(schema.usageLogs)
        .values({
          generatorId,
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          durationHours,
        })
        .returning();

      await recalculateTotalHours(db, generatorId);

      return reply.status(201).send({
        id: log.id,
        generatorId: log.generatorId,
        startTime: log.startTime,
        endTime: log.endTime,
        durationHours: log.durationHours,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.put('/api/generators/:id/logs/:logId', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const params = request.params as { id: string; logId: string };
    const generatorId = parseInt(params.id, 10);
    const logId = parseInt(params.logId, 10);

    if (isNaN(generatorId) || isNaN(logId)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    const validation = updateLogSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
    }

    const db = getDb();
    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    const [existing] = await db
      .select()
      .from(schema.usageLogs)
      .where(and(
        eq(schema.usageLogs.id, logId),
        eq(schema.usageLogs.generatorId, generatorId)
      ))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: 'Log entry not found' });

    const updateData = validation.data;
    const newStart = updateData.startTime ? new Date(updateData.startTime) : existing.startTime;
    const newEnd = updateData.endTime !== undefined
      ? (updateData.endTime ? new Date(updateData.endTime) : null)
      : existing.endTime;

    if (newEnd && newEnd <= newStart) {
      return reply.status(400).send({ error: 'endTime must be after startTime' });
    }

    const newDurationHours = newEnd
      ? calcDurationHours(newStart.toISOString(), newEnd.toISOString())
      : null;

    try {
      const [updated] = await db
        .update(schema.usageLogs)
        .set({
          startTime: newStart,
          endTime: newEnd,
          durationHours: newDurationHours,
          updatedAt: new Date(),
        })
        .where(eq(schema.usageLogs.id, logId))
        .returning();

      await recalculateTotalHours(db, generatorId);

      return reply.send({
        id: updated.id,
        generatorId: updated.generatorId,
        startTime: updated.startTime,
        endTime: updated.endTime,
        durationHours: updated.durationHours,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.delete('/api/generators/:id/logs/:logId', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const params = request.params as { id: string; logId: string };
    const generatorId = parseInt(params.id, 10);
    const logId = parseInt(params.logId, 10);

    if (isNaN(generatorId) || isNaN(logId)) {
      return reply.status(400).send({ error: 'Invalid ID' });
    }

    const db = getDb();
    const generator = await resolveOwnerGenerator(db, generatorId, userId);
    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    const [existing] = await db
      .select()
      .from(schema.usageLogs)
      .where(and(
        eq(schema.usageLogs.id, logId),
        eq(schema.usageLogs.generatorId, generatorId)
      ))
      .limit(1);

    if (!existing) return reply.status(404).send({ error: 'Log entry not found' });

    try {
      await db
        .delete(schema.usageLogs)
        .where(eq(schema.usageLogs.id, logId));

      await recalculateTotalHours(db, generatorId);

      return reply.status(204).send();
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
