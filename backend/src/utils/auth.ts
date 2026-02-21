import { scrypt, randomBytes, createHash, timingSafeEqual, type BinaryLike, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as unknown as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

// Passwords — scrypt, OWASP params: N=32768 r=8 p=1 keylen=64
// maxmem must be set explicitly; Node's default (32 MiB) equals N*128*r exactly, causing failures
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64, SCRYPT_PARAMS)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const candidate = (await scryptAsync(password, salt, 64, SCRYPT_PARAMS)) as Buffer;
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

// API keys — SHA-256 only; keys are 256-bit random, brute-forcing their hash is computationally infeasible
export function generateApiKey(): { raw: string; hash: string; hint: string } {
  const secret = randomBytes(32).toString('base64url');
  const raw = `gl_${secret}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const hint = raw.slice(-4);
  return { raw, hash, hint };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function validateApiKey(provided: string, storedHash: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest();
  const stored = Buffer.from(storedHash, 'hex');
  return timingSafeEqual(providedHash, stored);
}

// Sessions
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}
