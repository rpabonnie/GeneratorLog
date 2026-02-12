import Fastify from 'fastify';
import config from './config.js';

const server = Fastify({
  logger: {
    level: config.logLevel,
  },
});

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
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
