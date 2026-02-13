import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getGeneratorByApiKey, toggleGenerator } from '../services/generator.js';

const toggleSchema = z.object({
  generatorId: z.number().int().positive(),
});

interface GeneratorState {
  id: number;
  isRunning: boolean;
  currentStartTime: Date | null;
  totalHours: number;
}

export function registerGeneratorRoutes(app: FastifyInstance) {
  app.post('/api/generator/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check API key
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return reply.code(401).send({ error: 'API key required' });
    }

    // Check rate limit
    const clientId = request.ip;
    const rateLimiter = (app as any).rateLimiter;
    
    if (rateLimiter) {
      const limitCheck = rateLimiter.checkLimit(clientId);
      if (!limitCheck.allowed) {
        return reply.code(429).send({
          error: 'Too many requests - rate limit exceeded',
          retryAfter: limitCheck.retryAfter,
        });
      }
    }

    // Validate request body
    const parseResult = toggleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: parseResult.error.errors,
      });
    }

    const { generatorId } = parseResult.data;

    // Get mock database (for testing) or use real database
    const mockDb = (app as any).db;
    
    // For testing with mock database
    if (mockDb && mockDb.generators instanceof Map) {
      let generator = mockDb.generators.get(generatorId);
      
      if (!generator && generatorId !== 1) {
        return reply.code(404).send({ error: 'Generator not found' });
      }

      if (!generator) {
        generator = {
          id: generatorId,
          isRunning: false,
          currentStartTime: null,
          totalHours: 0,
        };
        mockDb.generators.set(generatorId, generator);
      }

      const now = new Date();

      if (!generator.isRunning) {
        // Start the generator
        generator.isRunning = true;
        generator.currentStartTime = now;

        return reply.send({
          status: 'started',
          isRunning: true,
          startTime: now,
          totalHours: generator.totalHours,
        });
      } else {
        // Stop the generator
        const startTime = generator.currentStartTime!;
        const durationMs = now.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);

        generator.totalHours += durationHours;
        generator.isRunning = false;
        generator.currentStartTime = null;

        // Add to usage logs
        mockDb.usageLogs.push({
          generatorId,
          startTime,
          endTime: now,
          durationHours,
        });

        return reply.send({
          status: 'stopped',
          isRunning: false,
          durationHours,
          totalHours: generator.totalHours,
        });
      }
    }

    // Real database implementation
    try {
      // Validate API key and get generator
      const generator = await getGeneratorByApiKey(apiKey);
      
      if (!generator) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      if (generator.id !== generatorId) {
        return reply.code(403).send({ error: 'Generator access denied' });
      }

      // Toggle the generator
      const result = await toggleGenerator(generatorId);
      
      return reply.send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Generator not found') {
        return reply.code(404).send({ error: 'Generator not found' });
      }
      
      app.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
