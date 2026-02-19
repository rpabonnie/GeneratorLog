# Security: Hashing Algorithms and Authentication Research

## Context

This research was triggered by two findings:

1. **API key storage is currently plaintext** — `backend/src/db/schema.ts` stores the raw 64-character hex key in the `api_keys.key` column, and `backend/src/services/generator.ts` compares it directly with `eq(schema.apiKeys.key, apiKey)`.
2. **Web authentication is not implemented** — `backend/src/routes/auth.ts` uses an email-only login with a temporary `x-user-id` header hack. There is no password or session system.

This document covers:
- Current state and what is wrong
- OWASP-approved password hashing options
- API key hashing best practices
- Authentication approaches for the web frontend

---

## Current State Assessment

| Component | Current Implementation | OWASP Status |
|-----------|----------------------|--------------|
| API key generation | `crypto.randomBytes(32).toString('hex')` | Correct |
| API key storage | Plaintext in `api_keys.key` column | **Non-compliant** |
| API key validation | `eq(schema.apiKeys.key, apiKey)` (direct comparison) | **Non-compliant** (timing attack vector) |
| Password hashing | None — no passwords exist | N/A |
| Web session auth | Temporary `x-user-id` header | **Non-compliant** |
| Rate limiting | Custom 1 req/sec per IP (in-memory) | Adequate for MVP |

---

## Option 1: Argon2id (OWASP First Choice for Passwords)

Argon2id won the 2015 Password Hashing Competition. The `id` variant combines side-channel resistance (Argon2i) and GPU-cracking resistance (Argon2d).

**OWASP recommended parameters**: `m=19456` (19 MiB memory), `t=2` (iterations), `p=1` (parallelism).
Minimum acceptable: `m=15360`, `t=2`, `p=1`.

**Strengths**:
- Memory-hard: each hash attempt requires large RAM, making GPU/ASIC farms economically infeasible
- Three independent tuning axes (memory, time, parallelism)
- Actively maintained and well-studied since 2015

**Weaknesses**:
- Not FIPS-140 validated (cannot use in US federal/regulated environments)
- Requires the `argon2` npm package (native C++ addon — needs Python + C++ compiler at build time)
- Higher per-request memory cost on the server (intentional)

**Node.js native support**: No. Requires `argon2` npm package.

**Fit for this project**: Moderate. Single purpose package, no transitive deps, but native compilation adds Docker build complexity.

---

## Option 2: scrypt (OWASP Second Choice — Native Node.js)

scrypt is a memory-hard function designed by Colin Percival in 2009. Available natively in Node.js `crypto` since v10.5.

**OWASP recommended parameters**: `N=32768` (2^15), `r=8`, `p=1`, output 64 bytes.

**Strengths**:
- Memory-hard — resists GPU-based brute force
- **Zero external dependencies** — ships with Node.js `crypto`
- OWASP second choice — still strongly recommended

**Weaknesses**:
- RAM and CPU cost are coupled through a single `N` parameter (harder to tune independently vs Argon2)
- Not FIPS-140 validated

**Node.js native support**: Yes. `crypto.scrypt()` / `crypto.scryptSync()`.

**Fit for this project**: Excellent. No extra packages, no build tooling, OWASP-compliant, memory-hard.

```typescript
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const candidate = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}
```

---

## Option 3: PBKDF2 (FIPS-140 Compliance Only)

PBKDF2 is defined in RFC 2898 and is NIST-recommended (SP 800-132). Required for US federal/government deployments.

**OWASP recommended parameters**: 600,000 iterations minimum with HMAC-SHA256.

**Strengths**:
- FIPS-140 validated implementations available
- Available natively in Node.js `crypto`
- Decades of production use

**Weaknesses**:
- **Not memory-hard** — GPU farms can parallelize attacks far more cheaply than Argon2/scrypt
- OWASP explicitly states: use only when FIPS-140 compliance is required

**Node.js native support**: Yes. `crypto.pbkdf2()` / `crypto.pbkdf2Sync()`.

**Fit for this project**: Poor security choice unless regulatory compliance is required. This app has no such requirement.

---

## Option 4: bcrypt (Legacy Systems Only)

bcrypt has been the dominant password hashing standard since 1999.

**OWASP recommended parameters**: Work factor (cost) minimum 10, prefer 12.

**Strengths**:
- Extremely well-tested, 25+ years of production use
- Automatic salt generation built in

**Weaknesses**:
- **72-byte truncation**: passwords longer than 72 bytes are silently truncated — a documented security defect
- Not memory-hard — modern GPU clusters attack it efficiently
- OWASP explicitly classifies it for **legacy systems only** as of current guidance
- Requires `bcrypt` or `bcryptjs` npm package

**Node.js native support**: No. External package required.

**Fit for this project**: Poor. Do not use for new code.

---

## Password Hashing Recommendation Summary

| Algorithm | OWASP Rank | Node.js Native | Memory-Hard | Recommendation |
|-----------|------------|---------------|-------------|----------------|
| Argon2id | 1st choice | No | Yes | Use if build tools available in Docker |
| scrypt | 2nd choice | Yes | Yes | **Recommended for this project** |
| PBKDF2 | 3rd (FIPS only) | Yes | No | Only if FIPS-140 is required |
| bcrypt | Legacy only | No | No | Do not use for new code |

---

## API Key Hashing: Industry Best Practices

### The Problem with Current Implementation

Storing keys in plaintext means a database breach immediately exposes every user's API key. The attacker can replay all keys against the live API.

### Why SHA-256, Not Argon2/scrypt, for API Keys

API keys are high-entropy random values (256 bits). Passwords are low-entropy human-chosen strings. Because an attacker who steals a SHA-256 hash of a 256-bit random key would still need to brute-force 2^256 possibilities, a slow memory-hard algorithm adds hundreds of milliseconds of latency per request with no additional security benefit. SHA-256 is the correct choice here.

### Industry Pattern (GitHub, Stripe, Shopify)

- **Generate**: `{prefix}_{randomBytes(32).toString('base64url')}` — prefix encodes app and type
- **Store**: `SHA-256(raw_key)` hash + last 4 characters as a UI hint + prefix
- **Show user**: full raw key exactly once at creation, with clear warning
- **Show in UI forever after**: `gl_...ab12` (prefix + `...` + last 4)
- **Validate**: hash the incoming key with SHA-256, compare with `timingSafeEqual`

```typescript
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

function generateApiKey(): { raw: string; hash: string; hint: string } {
  const secret = randomBytes(32).toString('base64url');
  const raw = `gl_${secret}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const hint = raw.slice(-4);
  return { raw, hash, hint };
}

function validateApiKey(provided: string, storedHash: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest();
  const stored = Buffer.from(storedHash, 'hex');
  return timingSafeEqual(providedHash, stored);
}
```

### Database Schema Change Required

```typescript
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(), // SHA-256 hex
  hint: varchar('hint', { length: 4 }).notNull(),                  // last 4 chars for UI
  name: varchar('name', { length: 255 }),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## Timing-Safe Comparison

### The Attack

Standard `===` short-circuits on the first mismatched byte. An attacker can send thousands of requests with varying keys and measure response times in nanoseconds to statistically reconstruct a stored hash one byte at a time.

### Node.js Solution

`crypto.timingSafeEqual` is available natively since Node.js v6.6. No external package needed.

**Critical rules**:
1. Input buffers must be equal length — hash both sides to SHA-256 first (always 32 bytes)
2. Never add an early-exit length check before calling it — that leaks length information
3. Always go through the full code path even for invalid/unknown keys (use a dummy hash)

```typescript
// WRONG — leaks length via early exit
if (provided.length !== stored.length) return false;

// CORRECT — hash both to fixed length first
const a = createHash('sha256').update(provided).digest();
const b = createHash('sha256').update(stored).digest();
return timingSafeEqual(a, b);
```

Password hashing libraries (`scrypt` verify, Argon2 `verify`) handle timing-safe comparison internally. Only use `timingSafeEqual` directly when comparing raw-hash strings (SHA-256 of API keys, session IDs).

---

## Web Frontend Authentication Options

### Option A: Username + Password with Server-Side Sessions

User submits credentials → server validates, creates a session record in PostgreSQL, sets an `HttpOnly` cookie with an opaque random session ID. All subsequent requests carry the cookie.

**Strengths**:
- Instant revocation: delete session row = user is logged out immediately
- OWASP Session Management Cheat Sheet provides complete, mature guidance
- Cookies with `HttpOnly; Secure; SameSite=Strict` are battle-tested
- Zero new infrastructure — one `sessions` table in the existing PostgreSQL database
- ~80 lines of custom code, no external libraries

**Weaknesses**:
- Stateful: requires a database lookup per request
- CSRF protection needed (mitigated by `SameSite=Strict`)
- Horizontal scaling requires shared session store (single-server deployment is fine)

**OWASP requirements**:
- Session ID: 64+ bits of entropy (`randomBytes(32)` = 256 bits ✓)
- Regenerate session ID after login/logout/privilege change
- Cookie flags: `HttpOnly; Secure; SameSite=Strict; Path=/`
- Idle timeout: 15-30 min (configurable)
- Absolute timeout: 8-24 hours

**Node.js native support**: Full. `crypto.randomBytes()` for session ID, one `sessions` table in PostgreSQL, no packages needed.

**Fit for this project**: Excellent. Matches the existing architecture and OWASP guidance.

---

### Option B: JWTs (JSON Web Tokens)

Server issues a signed token containing claims. Client stores it and sends it with every request. Server validates signature without a DB lookup.

**Strengths**:
- Stateless — no session store needed
- Good for distributed/microservice architectures

**Weaknesses**:
- **No revocation without a denylist** (which reintroduces server-side state)
- Algorithm confusion attacks (`alg: none` exploit)
- Token sidejacking — a stolen JWT is valid until expiry
- Payload is base64-encoded, not encrypted — readable by anyone
- OWASP explicitly: "If your application does not need to be fully stateless, consider using traditional session system"
- Requires `jose` or `jsonwebtoken` external package

**Fit for this project**: Poor. The app is single-server, already has PostgreSQL, and the stateless benefit does not apply here. Adds complexity without benefit.

---

### Option C: Magic Links (Passwordless Email)

User enters email → server emails a one-time token link → clicking it creates a session. Already partially scoped (email/SMTP is planned for maintenance reminders).

**Strengths**:
- No passwords to hash or manage
- Eliminates credential stuffing
- Reuses SMTP infrastructure already planned for the project

**Weaknesses**:
- Depends on email delivery reliability — if email fails, user is locked out
- Email is not a fully secure channel
- Tokens must be single-use, short-lived (15 min max), and high-entropy
- UX friction: requires checking email for every new session

**Fit for this project**: Moderate. Avoids password management complexity, but UX friction is real. SMTP is already planned so infrastructure cost is low.

---

## Web Auth Recommendation Summary

| Approach | Revocation | OWASP Guidance | External Packages | Complexity |
|----------|-----------|---------------|------------------|-----------|
| Sessions + Cookies | Instant (delete row) | Comprehensive | None needed | Low |
| JWTs | Denylist only | "Use sessions instead" | `jose` or `jsonwebtoken` | High |
| Magic Links | N/A (one-time) | General token rules | None (SMTP exists) | Medium |

---

## Overall Recommendation

All recommended approaches use only Node.js built-in modules and zero new external packages:

| Concern | Recommended Approach | Package |
|---------|---------------------|---------|
| User password hashing | `scrypt` via `node:crypto` | None |
| API key generation | `randomBytes(32).toString('base64url')` with `gl_` prefix | None |
| API key storage | SHA-256 hash only — never plaintext | None |
| API key validation | SHA-256 hash + `timingSafeEqual` | None |
| Web session auth | Opaque random session ID in PostgreSQL `sessions` table | None |
| Frontend auth method | Username + password with server-side sessions | None |
| Cookie flags | `HttpOnly; Secure; SameSite=Strict; Path=/` | None |

This satisfies OWASP guidelines, eliminates the current plaintext API key vulnerability, and introduces a proper session-based authentication system — all with zero new external dependencies.
