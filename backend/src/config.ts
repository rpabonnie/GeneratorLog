import 'dotenv/config';

interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  corsOrigin: string;
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
  email: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
    secure: boolean;
  };
  logLevel: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'GeneratorLog <noreply@generatorlog.com>',
    secure: process.env.SMTP_SECURE === 'true',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
