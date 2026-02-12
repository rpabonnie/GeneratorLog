import { describe, expect, it } from 'vitest';
import config from './config.js';

describe('config defaults', () => {
  it('uses sane defaults for local development', () => {
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.apiRateLimit).toBe(1);
    expect(config.session.secret).not.toBe('');
    expect(config.logLevel).toBe('info');
  });
});
