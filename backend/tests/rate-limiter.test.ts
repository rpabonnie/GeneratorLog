import { describe, expect, it, beforeEach } from 'vitest';
import { RateLimiter } from '../src/middleware/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(1); // 1 request per second
  });

  it('allows requests under the rate limit', async () => {
    const clientId = '192.168.1.1';
    
    const result1 = rateLimiter.checkLimit(clientId);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(0);
  });

  it('blocks requests exceeding the rate limit', async () => {
    const clientId = '192.168.1.1';
    
    const result1 = rateLimiter.checkLimit(clientId);
    expect(result1.allowed).toBe(true);
    
    const result2 = rateLimiter.checkLimit(clientId);
    expect(result2.allowed).toBe(false);
    expect(result2.retryAfter).toBeGreaterThan(0);
  });

  it('resets the limit after the time window', async () => {
    const clientId = '192.168.1.1';
    
    const result1 = rateLimiter.checkLimit(clientId);
    expect(result1.allowed).toBe(true);
    
    const result2 = rateLimiter.checkLimit(clientId);
    expect(result2.allowed).toBe(false);
    
    // Wait for 1.1 seconds to reset the window
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const result3 = rateLimiter.checkLimit(clientId);
    expect(result3.allowed).toBe(true);
  });

  it('tracks different clients independently', () => {
    const client1 = '192.168.1.1';
    const client2 = '192.168.1.2';
    
    const result1 = rateLimiter.checkLimit(client1);
    expect(result1.allowed).toBe(true);
    
    const result2 = rateLimiter.checkLimit(client1);
    expect(result2.allowed).toBe(false);
    
    const result3 = rateLimiter.checkLimit(client2);
    expect(result3.allowed).toBe(true);
  });

  it('cleans up old entries automatically', () => {
    const clientId = '192.168.1.1';
    
    rateLimiter.checkLimit(clientId);
    
    // Force cleanup by accessing private method (testing implementation detail)
    const limiterAny = rateLimiter as any;
    const sizeBefore = limiterAny.clients.size;
    expect(sizeBefore).toBe(1);
    
    // Wait for cleanup interval
    setTimeout(() => {
      const sizeAfter = limiterAny.clients.size;
      expect(sizeAfter).toBe(0);
    }, 65000);
  });
});
