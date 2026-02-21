import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateApiKey } from '../utils/auth.js';
import { generateToggleShortcut } from '../utils/shortcut.js';
import QRCode from 'qrcode';
import config from '../config.js';

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

  // Serves a ready-to-import .shortcut file. No session auth required — the file contains
  // no sensitive data. The API key is requested via an import question when the user imports
  // the shortcut on their iPhone.
  app.get('/api/api-keys/:id/shortcut-file', async (request, reply) => {
    const params = request.params as { id: string };
    const keyId = parseInt(params.id, 10);
    if (isNaN(keyId)) return reply.status(400).send({ error: 'Invalid API key ID' });

    const db = getDb();

    try {
      const [apiKey] = await db
        .select()
        .from(schema.apiKeys)
        .where(eq(schema.apiKeys.id, keyId))
        .limit(1);

      if (!apiKey) return reply.status(404).send({ error: 'API key not found' });

      const toggleEndpoint = `${config.apiBaseUrl}/api/generator/toggle`;
      const shortcutName = apiKey.name ? `${apiKey.name} Toggle` : 'Generator Toggle';
      const plist = generateToggleShortcut(toggleEndpoint, shortcutName);

      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${shortcutName}.shortcut"`)
        .send(plist);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Returns a QR code whose deep link opens iOS Shortcuts and immediately imports the
  // pre-configured shortcut. The shortcut asks for the API key once on import.
  app.get('/api/api-keys/:id/qrcode', async (request, reply) => {
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

      const shortcutFileUrl = `${config.apiBaseUrl}/api/api-keys/${keyId}/shortcut-file`;
      const deepLink = `shortcuts://import-workflow?url=${encodeURIComponent(shortcutFileUrl)}`;

      const qrDataUrl = await QRCode.toDataURL(deepLink, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      return reply.send({ qrCode: qrDataUrl, shortcutFileUrl });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/api/api-keys/:id/shortcut-info', async (request, reply) => {
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

      return reply.send({
        id: existing.id,
        name: existing.name,
        hint: `gl_...${existing.hint}`,
        apiEndpoint: `${config.apiBaseUrl}/api/generator/toggle`,
        shortcutFileUrl: `${config.apiBaseUrl}/api/api-keys/${keyId}/shortcut-file`,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
