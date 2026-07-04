import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getGeneratorByApiKey, toggleGenerator } from '../services/generator.js';
import { sendGeneratorStopEmails } from '../services/email.js';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

export function registerGeneratorRoutes(app: FastifyInstance) {
  app.post('/api/generator/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return reply.code(401).send({ error: 'API key required' });
    }

    // Rate limiting uses API key + IP combination to allow multiple users concurrently
    // while still protecting against brute force attacks from a single source
    const clientId = `${apiKey}:${request.ip}`;
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
        // Security log (OWASP): never log the attempted key itself, only a hint
        app.log.warn(
          { security: 'invalid_api_key', ip: request.ip, keyHint: apiKey.slice(-4), url: request.url },
          'Rejected request with invalid API key'
        );
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const result = await toggleGenerator(generator.id);

      // Send email notification if generator was stopped
      if (result.status === 'stopped') {
        try {
          const db = getDb();
          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, generator.userId))
            .limit(1);

          if (user) {
            // Fetch fresh generator data after toggle to ensure email uses updated lastOilChangeHours/Date
            const [freshGenerator] = await db
              .select()
              .from(schema.generators)
              .where(eq(schema.generators.id, generator.id))
              .limit(1);

            if (freshGenerator) {
              await sendGeneratorStopEmails(user.email, {
                generatorName: freshGenerator.name,
                durationHours: result.durationHours,
                totalHours: result.totalHours,
                lastOilChangeHours: freshGenerator.lastOilChangeHours,
                oilChangeHours: freshGenerator.oilChangeHours,
                lastOilChangeDate: freshGenerator.lastOilChangeDate,
                oilChangeMonths: freshGenerator.oilChangeMonths,
                installedAt: freshGenerator.installedAt,
              });
            }
          }
        } catch (emailError) {
          app.log.error(emailError);
        }
      }

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
