import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createShortcutToken, decryptApiKey, encryptApiKey, generateApiKey, verifyShortcutToken } from '../utils/auth.js';
import { generateToggleShortcut } from '../utils/shortcut.js';
import QRCode from 'qrcode';
import config from '../config.js';

const createApiKeySchema = z.object({
  name: z.string().min(1).optional(),
});

function getPublicBaseUrl(request: any): string {
  if (config.apiBaseUrl) return config.apiBaseUrl;
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)
    || request.protocol
    || 'http';
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
    || request.headers['host'];
  if (!host) return `http://localhost:${config.port}`;
  return `${protocol}://${host}`;
}

function buildShortcutFileUrl(request: any, keyId: number): string {
  const baseUrl = getPublicBaseUrl(request);
  const expiresAtMs = Date.now() + 1000 * 60 * 60;
  const token = createShortcutToken(keyId, expiresAtMs);
  return `${baseUrl}/api/api-keys/${keyId}/shortcut-file?token=${encodeURIComponent(token)}`;
}

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
      const encryptedKey = encryptApiKey(raw);

      const [newApiKey] = await db
        .insert(schema.apiKeys)
        .values({ userId, keyHash: hash, encryptedKey, hint, name: name || null })
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
      const encryptedKey = encryptApiKey(raw);

      const [updated] = await db
        .update(schema.apiKeys)
        .set({ keyHash: hash, encryptedKey, hint, lastUsedAt: null })
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

  // Serves a ready-to-import .shortcut file. Requires either a valid session for the
  // owning user or a short-lived token embedded in the URL.
  app.get('/api/api-keys/:id/shortcut-file', async (request, reply) => {
    const userId = (request as any).sessionUser?.id ?? null;
    const params = request.params as { id: string };
    const keyId = parseInt(params.id, 10);
    if (isNaN(keyId)) return reply.status(400).send({ error: 'Invalid API key ID' });

    const query = request.query as { token?: string };
    const token = query?.token;

    const db = getDb();

    try {
      const [apiKey] = await db
        .select()
        .from(schema.apiKeys)
        .where(userId
          ? and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, userId))
          : eq(schema.apiKeys.id, keyId))
        .limit(1);

      if (!apiKey) return reply.status(404).send({ error: 'API key not found' });

      if (!userId) {
        if (!token || !verifyShortcutToken(keyId, token)) {
          return reply.status(401).send({ error: 'Shortcut link expired or invalid' });
        }
      }

      if (!apiKey.encryptedKey) {
        return reply.status(409).send({ error: 'Reset this API key to enable pre-filled shortcuts' });
      }

      const rawKey = decryptApiKey(apiKey.encryptedKey);
      const toggleEndpoint = `${getPublicBaseUrl(request)}/api/generator/toggle`;
      const shortcutName = apiKey.name ? `${apiKey.name} Toggle` : 'Generator Toggle';
      const plist = generateToggleShortcut(toggleEndpoint, shortcutName, rawKey);

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

      if (!existing.encryptedKey) {
        return reply.status(409).send({ error: 'Reset this API key to enable pre-filled shortcuts' });
      }

      const shortcutFileUrl = buildShortcutFileUrl(request, keyId);
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

      if (!existing.encryptedKey) {
        return reply.status(409).send({ error: 'Reset this API key to enable pre-filled shortcuts' });
      }

      const baseUrl = getPublicBaseUrl(request);

      return reply.send({
        id: existing.id,
        name: existing.name,
        hint: `gl_...${existing.hint}`,
        apiEndpoint: `${baseUrl}/api/generator/toggle`,
        shortcutFileUrl: buildShortcutFileUrl(request, keyId),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
