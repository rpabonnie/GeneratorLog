import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { sendTestEmail, getEmailTransporter } from '../services/email.js';

function getUserId(request: any): number | null {
  return (request.sessionUser?.id) ?? null;
}

export async function emailRoutes(app: FastifyInstance) {
  app.post('/api/email/test', async (request, reply) => {
    const userId = getUserId(request);

    if (!userId) {
      return reply.status(401).send({
        error: 'Not authenticated',
      });
    }

    const emailTransporter = getEmailTransporter();
    if (!emailTransporter) {
      return reply.status(503).send({
        error: 'Email service not configured',
        message: 'Please configure SMTP settings in your environment variables',
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
        return reply.status(404).send({
          error: 'User not found',
        });
      }

      await sendTestEmail(user.email, user.name || 'User');

      return reply.send({
        success: true,
        message: `Test email sent to ${user.email}`,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Failed to send test email',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
