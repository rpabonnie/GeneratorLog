import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getGeneratorByApiKey, toggleGenerator } from '../services/generator.js';

export function registerGeneratorRoutes(app: FastifyInstance) {
  app.post('/api/generator/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return reply.code(401).send({ error: 'API key required' });
    }

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

    try {
      const generator = await getGeneratorByApiKey(apiKey);
      if (!generator) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const result = await toggleGenerator(generator.id);
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
