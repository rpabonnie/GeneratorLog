import 'dotenv/config';

interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  apiRateLimit: number;
  session: {
    secret: string;
    cookieName: string;
    maxAge: number;
  };
  logLevel: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'generatorlog',
    user: process.env.DB_USER || 'generatorlog',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
  },
  apiRateLimit: parseInt(process.env.API_RATE_LIMIT || '1', 10),
  session: {
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    cookieName: process.env.SESSION_COOKIE_NAME || 'generatorlog_session',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
