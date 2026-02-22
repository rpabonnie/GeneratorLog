import {
  scrypt,
  randomBytes,
  createHash,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHmac,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';
import config from '../config.js';

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

function deriveEncryptionKey(): Buffer {
  return createHash('sha256').update(config.session.secret).digest();
}

export function encryptApiKey(raw: string): string {
  const key = deriveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptApiKey(encrypted: string): string {
  const [ivB64, tagB64, dataB64] = encrypted.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted API key format');
  }
  const key = deriveEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
}

export function createShortcutToken(keyId: number, expiresAtMs: number): string {
  const payload = `${keyId}.${expiresAtMs}`;
  const signature = createHmac('sha256', deriveEncryptionKey())
    .update(payload)
    .digest('base64url');
  return `${expiresAtMs}.${signature}`;
}

export function verifyShortcutToken(keyId: number, token: string): boolean {
  const [expiresRaw, signature] = token.split('.');
  if (!expiresRaw || !signature) return false;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;
  const payload = `${keyId}.${expiresAtMs}`;
  const expected = createHmac('sha256', deriveEncryptionKey())
    .update(payload)
    .digest('base64url');
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Sessions
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}
