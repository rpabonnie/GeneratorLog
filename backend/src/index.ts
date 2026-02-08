import Fastify from 'fastify';
import { config } from './config.js';

const fastify = Fastify({
  logger: true
});

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await fastify.listen({ 
      port: config.port, 
      host: config.host 
    });
    console.log(`Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
