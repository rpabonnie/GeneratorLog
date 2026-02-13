import Fastify from 'fastify';
import config from './config.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { registerGeneratorRoutes } from './routes/generator.js';

const server = Fastify({
  logger: {
    level: config.logLevel,
  },
});

// Initialize rate limiter
const rateLimiter = new RateLimiter(config.apiRateLimit);
server.decorate('rateLimiter', rateLimiter);

// Register routes
registerGeneratorRoutes(server);

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
