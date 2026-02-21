import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getGeneratorByApiKey, toggleGenerator } from '../services/generator.js';
import { sendStopConfirmationEmail, sendMaintenanceReminderEmail, getEmailTransporter } from '../services/email.js';
import { shouldSendMaintenanceReminder } from '../services/maintenance.js';
import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

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

      // Send email notification if generator was stopped
      if (result.status === 'stopped') {
        try {
          const emailTransporter = getEmailTransporter();
          if (emailTransporter) {
            const db = getDb();
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, generator.userId))
              .limit(1);

            if (user) {
              const needsMaintenance = shouldSendMaintenanceReminder(
                result.totalHours,
                generator.lastOilChangeHours,
                generator.oilChangeHours,
                generator.lastOilChangeDate,
                generator.oilChangeMonths
              );

              if (needsMaintenance) {
                await sendMaintenanceReminderEmail(user.email, {
                  generatorName: generator.name,
                  totalHours: result.totalHours,
                  lastOilChangeHours: generator.lastOilChangeHours,
                  oilChangeHours: generator.oilChangeHours,
                  lastOilChangeDate: generator.lastOilChangeDate,
                  oilChangeMonths: generator.oilChangeMonths,
                });
              } else {
                await sendStopConfirmationEmail(user.email, {
                  generatorName: generator.name,
                  durationHours: result.durationHours,
                  totalHours: result.totalHours,
                  lastOilChangeHours: generator.lastOilChangeHours,
                  oilChangeHours: generator.oilChangeHours,
                  lastOilChangeDate: generator.lastOilChangeDate,
                  oilChangeMonths: generator.oilChangeMonths,
                });
              }
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
