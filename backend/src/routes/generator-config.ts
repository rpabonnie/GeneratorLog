import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { toggleGenerator } from '../services/generator.js';

const createGeneratorSchema = z.object({
  name: z.string().min(1),
  oilChangeMonths: z.number().int().positive().optional().default(6),
  oilChangeHours: z.number().positive().optional().default(100),
  installedAt: z.coerce.date().nullable().optional(),
});

const updateGeneratorSchema = z.object({
  name: z.string().min(1).optional(),
  oilChangeMonths: z.number().int().positive().optional(),
  oilChangeHours: z.number().positive().optional(),
  installedAt: z.coerce.date().nullable().optional(),
}).refine(data =>
  data.name !== undefined ||
  data.oilChangeMonths !== undefined ||
  data.oilChangeHours !== undefined ||
  data.installedAt !== undefined, {
  message: 'At least one field must be provided',
});

function getUserId(request: any): number | null {
  return (request.sessionUser?.id) ?? null;
}

export async function generatorConfigRoutes(app: FastifyInstance) {
  app.post('/api/generators', async (request, reply) => {
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const validation = createGeneratorSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { name, oilChangeMonths, oilChangeHours, installedAt } = validation.data;
    const db = getDb();

    try {
      const [newGenerator] = await db
        .insert(schema.generators)
        .values({
          userId,
          name,
          oilChangeMonths,
          oilChangeHours,
          installedAt: installedAt ?? null,
        })
        .returning();

      return reply.status(201).send({
        id: newGenerator.id,
        name: newGenerator.name,
        oilChangeMonths: newGenerator.oilChangeMonths,
        oilChangeHours: newGenerator.oilChangeHours,
        totalHours: newGenerator.totalHours,
        lastOilChangeDate: newGenerator.lastOilChangeDate,
        lastOilChangeHours: newGenerator.lastOilChangeHours,
        installedAt: newGenerator.installedAt,
        isRunning: newGenerator.isRunning,
        createdAt: newGenerator.createdAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.get('/api/generators', async (request, reply) => {
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const db = getDb();

    try {
      const generators = await db
        .select()
        .from(schema.generators)
        .where(eq(schema.generators.userId, userId));

      return reply.send(generators.map(g => ({
        id: g.id,
        name: g.name,
        oilChangeMonths: g.oilChangeMonths,
        oilChangeHours: g.oilChangeHours,
        totalHours: g.totalHours,
        lastOilChangeDate: g.lastOilChangeDate,
        lastOilChangeHours: g.lastOilChangeHours,
        installedAt: g.installedAt,
        isRunning: g.isRunning,
        currentStartTime: g.currentStartTime,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })));
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.get('/api/generators/:id', async (request, reply) => {
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const params = request.params as { id: string };
    const generatorId = parseInt(params.id, 10);

    if (isNaN(generatorId)) {
      return reply.status(400).send({
        error: 'Invalid generator ID',
      });
    }

    const db = getDb();

    try {
      const [generator] = await db
        .select()
        .from(schema.generators)
        .where(and(
          eq(schema.generators.id, generatorId),
          eq(schema.generators.userId, userId)
        ))
        .limit(1);

      if (!generator) {
        return reply.status(404).send({
          error: 'Generator not found',
        });
      }

      return reply.send({
        id: generator.id,
        name: generator.name,
        oilChangeMonths: generator.oilChangeMonths,
        oilChangeHours: generator.oilChangeHours,
        totalHours: generator.totalHours,
        lastOilChangeDate: generator.lastOilChangeDate,
        lastOilChangeHours: generator.lastOilChangeHours,
        installedAt: generator.installedAt,
        isRunning: generator.isRunning,
        currentStartTime: generator.currentStartTime,
        createdAt: generator.createdAt,
        updatedAt: generator.updatedAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.put('/api/generators/:id', async (request, reply) => {
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const params = request.params as { id: string };
    const generatorId = parseInt(params.id, 10);

    if (isNaN(generatorId)) {
      return reply.status(400).send({
        error: 'Invalid generator ID',
      });
    }

    const validation = updateGeneratorSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { name, oilChangeMonths, oilChangeHours, installedAt } = validation.data;
    const db = getDb();

    try {
      // Check if generator exists and belongs to user
      const [existing] = await db
        .select()
        .from(schema.generators)
        .where(and(
          eq(schema.generators.id, generatorId),
          eq(schema.generators.userId, userId)
        ))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: 'Generator not found',
        });
      }

      // Build update object
      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (oilChangeMonths !== undefined) updateData.oilChangeMonths = oilChangeMonths;
      if (oilChangeHours !== undefined) updateData.oilChangeHours = oilChangeHours;
      if (installedAt !== undefined) updateData.installedAt = installedAt;

      const [updatedGenerator] = await db
        .update(schema.generators)
        .set(updateData)
        .where(eq(schema.generators.id, generatorId))
        .returning();

      return reply.send({
        id: updatedGenerator.id,
        name: updatedGenerator.name,
        oilChangeMonths: updatedGenerator.oilChangeMonths,
        oilChangeHours: updatedGenerator.oilChangeHours,
        totalHours: updatedGenerator.totalHours,
        lastOilChangeDate: updatedGenerator.lastOilChangeDate,
        lastOilChangeHours: updatedGenerator.lastOilChangeHours,
        installedAt: updatedGenerator.installedAt,
        isRunning: updatedGenerator.isRunning,
        currentStartTime: updatedGenerator.currentStartTime,
        updatedAt: updatedGenerator.updatedAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.post('/api/generators/:id/toggle', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.status(401).send({ error: 'Not authenticated' });

    const generatorId = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(generatorId)) return reply.status(400).send({ error: 'Invalid generator ID' });

    const db = getDb();
    const [generator] = await db
      .select()
      .from(schema.generators)
      .where(and(eq(schema.generators.id, generatorId), eq(schema.generators.userId, userId)))
      .limit(1);

    if (!generator) return reply.status(404).send({ error: 'Generator not found' });

    try {
      const result = await toggleGenerator(generatorId);
      return reply.send(result);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
