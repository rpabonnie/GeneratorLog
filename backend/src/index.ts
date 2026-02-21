import Fastify from 'fastify';
import config from './config.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { registerGeneratorRoutes } from './routes/generator.js';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { generatorConfigRoutes } from './routes/generator-config.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { usageLogsRoutes } from './routes/usage-logs.js';
import { oilChangeHistoryRoutes } from './routes/oil-change-history.js';
import { registerSessionMiddleware } from './services/session.js';

const server = Fastify({
  logger: {
    level: config.logLevel,
  },
});

// Initialize rate limiter
const rateLimiter = new RateLimiter(config.apiRateLimit);
server.decorate('rateLimiter', rateLimiter);

// CORS — reflect localhost/LAN origins in development, enforce configured origin in production
server.addHook('onRequest', async (request, reply) => {
  const origin = request.headers['origin'] ?? '';
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
  const allowedOrigin = (config.nodeEnv !== 'production' && isLocalOrigin) ? origin : config.corsOrigin;
  reply.header('Access-Control-Allow-Origin', allowedOrigin);
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  reply.header('Access-Control-Allow-Credentials', 'true');
  if (request.method === 'OPTIONS') {
    return reply.status(204).send();
  }
});

// Session middleware — populates request.sessionUser from cookie on every request
registerSessionMiddleware(server);

// Register routes
registerGeneratorRoutes(server);
authRoutes(server);
profileRoutes(server);
generatorConfigRoutes(server);
apiKeyRoutes(server);
usageLogsRoutes(server);
oilChangeHistoryRoutes(server);

// Health check endpoint
server.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  };
});

// Root endpoint
server.get('/', async () => {
  return {
    name: 'GeneratorLog API',
    version: '1.0.0',
    status: 'running',
  };
});

const start = async () => {
  try {
    await server.listen({
      port: config.port,
      host: config.host,
    });

    server.log.info(`Server started successfully`);
    server.log.info(`Environment: ${config.nodeEnv}`);
    server.log.info(`Listening on ${config.host}:${config.port}`);
    server.log.info(`Rate limit: ${config.apiRateLimit} requests per second`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  server.log.info('Shutting down gracefully...');
  rateLimiter.destroy();
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
