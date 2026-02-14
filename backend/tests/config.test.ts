import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dotenv to prevent it from loading .env file during tests
vi.mock('dotenv/config', () => ({}));

const originalEnv = { ...process.env };

const loadConfig = async () => {
  const module = await import('../src/config.js');
  return module.default;
};

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('config', () => {
  it('falls back to sensible defaults when env vars are not set', async () => {
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.NODE_ENV;
    delete process.env.API_RATE_LIMIT;
    delete process.env.DB_SSL;
    delete process.env.SESSION_SECRET;

    const config = await loadConfig();

    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.nodeEnv).toBe('development');
    expect(config.apiRateLimit).toBe(1);
    expect(config.session.secret).toBe('change-this-secret');
    expect(config.database.ssl).toBe(false);
  });

  it('reads all configuration values from the environment', async () => {
    process.env.PORT = '4000';
    process.env.HOST = '127.0.0.1';
    process.env.NODE_ENV = 'production';
    process.env.API_RATE_LIMIT = '5';
    process.env.DATABASE_URL = 'postgresql://tester:secret@db:5432/app';
    process.env.DB_SSL = 'true';
    process.env.SESSION_SECRET = 'super-secret';

    const config = await loadConfig();

    expect(config.port).toBe(4000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.nodeEnv).toBe('production');
    expect(config.apiRateLimit).toBe(5);
    expect(config.database.url).toBe('postgresql://tester:secret@db:5432/app');
    expect(config.database.ssl).toBe(true);
    expect(config.session.secret).toBe('super-secret');
  });
});
