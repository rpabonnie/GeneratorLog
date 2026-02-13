interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private clients: Map<string, ClientRecord> = new Map();
  private requestsPerSecond: number;
  private windowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(requestsPerSecond: number) {
    this.requestsPerSecond = requestsPerSecond;
    this.windowMs = 1000; // 1 second window

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, record] of this.clients.entries()) {
        if (now > record.resetTime) {
          this.clients.delete(clientId);
        }
      }
    }, 60000);
  }

  checkLimit(clientId: string): RateLimitResult {
    const now = Date.now();
    const record = this.clients.get(clientId);

    if (!record || now > record.resetTime) {
      // New window or client
      this.clients.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs,
      });

      return {
        allowed: true,
        remaining: this.requestsPerSecond - 1,
      };
    }

    if (record.count < this.requestsPerSecond) {
      // Within limit
      record.count++;
      return {
        allowed: true,
        remaining: this.requestsPerSecond - record.count,
      };
    }

    // Exceeded limit
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
  }
}
