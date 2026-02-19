# ADR 0003: Security — API Key Hashing, Password Hashing, and Web Authentication

**Date**: 2026-02-18
**Status**: Accepted
**Deciders**: Ray Pabonnie, Claude Code
**Context**: Security hardening for a public-facing web service

---

## Context and Problem Statement

GeneratorLog is a public-facing service with two distinct security surfaces:

1. **API surface** — iOS Shortcuts calls the `/api/generator/toggle` endpoint using an API key in the `x-api-key` header. Currently, API keys are stored **in plaintext** in the `api_keys` table, and comparison is done with a direct SQL `=` predicate — both OWASP non-compliant.

2. **Web dashboard** — Users manage their generator configuration, API keys, and usage history. Currently there is no real authentication; a placeholder `x-user-id` header is used. No password system exists.

Research document: [`docs/00004-security-hashing-and-auth-research.md`](../00004-security-hashing-and-auth-research.md)

---

## Decision Drivers

1. **OWASP compliance** — Public-facing app requires adherence to OWASP Top 10 and relevant cheat sheets
2. **Zero new dependencies** — Prefer Node.js built-in `node:crypto` over external libraries
3. **Azure F1 Free tier constraints** — 60 CPU minutes/day, 1 GB RAM shared; algorithm choice must respect this
4. **API call latency** — iOS Shortcuts toggle must be fast; authentication overhead must be minimal
5. **Minimal-dependency philosophy** — Per CLAUDE.md, only add a library if writing the code would take significant effort

---

## Considered Options

### API Key Storage

| Option | Security | Latency per request | CPU budget impact | External package |
|--------|----------|--------------------|--------------------|-----------------|
| Plaintext (current) | Non-compliant | ~0ms | None | None |
| SHA-256 + timingSafeEqual | Compliant | ~0.1ms | Negligible | None |
| Argon2id | Unnecessary | ~100-200ms | ~40 hashes exhaust daily CPU budget | `argon2` |
| scrypt | Unnecessary | ~50-100ms | Significant impact | None |

Argon2id and scrypt exist to slow down brute-force attacks on **low-entropy** secrets. API keys are 256-bit cryptographically random values — brute-forcing a SHA-256 hash of such a key requires 2^256 attempts regardless of hardware. Slow hashing adds latency and CPU cost with zero security benefit.

### Password Hashing

| Algorithm | OWASP Rank | Memory-hard | External package | Azure F1 compatible |
|-----------|-----------|-------------|-----------------|---------------------|
| Argon2id | 1st choice | Yes | `argon2` (native C++) | Yes (marginal CPU, low-traffic app) |
| scrypt | 2nd choice | Yes | None (node:crypto) | Yes |
| PBKDF2 | 3rd (FIPS only) | No | None (node:crypto) | Yes |
| bcrypt | Legacy only | No | `bcrypt` or `bcryptjs` | Yes |

### Web Authentication

| Approach | Revocation | OWASP guidance | External packages | Stateful |
|----------|-----------|---------------|------------------|---------|
| Server-side sessions (PostgreSQL) | Instant | Comprehensive, well-defined | None | Yes (DB) |
| JWTs | Denylist only | "Use sessions if not stateless" | `jose` or `jsonwebtoken` | Partial |
| Magic links (passwordless) | N/A (one-time) | General token rules | None | Yes (DB) |

---

## Decision Outcome

### Decision 1: API Key Storage — SHA-256 + timingSafeEqual

**Chosen**: SHA-256 hash of the raw key stored in the database. Validation via `crypto.timingSafeEqual` after hashing the incoming key.

**Rationale**:
- Industry standard used by GitHub, Stripe, and Shopify for identical reasons
- API keys are high-entropy random values; SHA-256 is computationally infeasible to reverse regardless of hardware
- Adds ~0.1ms latency per API call vs ~150ms for Argon2id
- On Azure F1, Argon2id would exhaust the 60 CPU min/day budget at ~40 toggle operations; SHA-256 is negligible
- Zero external dependencies

**Implementation**:
- Generate: `gl_` prefix + `randomBytes(32).toString('base64url')` (~256 bits entropy)
- Store: `SHA-256(raw_key)` hex string + last 4 characters as UI hint
- Show user: raw key exactly once at creation; `gl_...ab12` in UI thereafter
- Validate: hash incoming key with SHA-256, compare with `crypto.timingSafeEqual`

### Decision 2: Password Hashing — scrypt via node:crypto

**Chosen**: `scrypt` using Node.js built-in `crypto.scrypt()`.

**Rationale**:
- OWASP second choice — memory-hard, strongly recommended
- Zero external dependencies; ships inside Node.js
- Avoids native C++ addon compilation complexity in Docker/Azure deployments
- Real-world protection is equivalent to Argon2id for this use case (low-traffic single app)
- Parameters: `N=32768, r=8, p=1` per OWASP guidance, output 64 bytes

**Note on Argon2id**: Argon2id is OWASP's first choice and was evaluated. It was not selected because the `argon2` npm package requires native C++ compilation via `node-gyp`, adding Docker build complexity and a deployment-time dependency on build tools. If the project's Docker image gains build tools for other reasons, or if a significant user base requires maximally hardened password storage, upgrading to Argon2id is a straightforward swap.

### Decision 3: Web Authentication — Username + Password with Server-Side Sessions

**Chosen**: Username (email) + password with opaque random session IDs stored in a PostgreSQL `sessions` table. Sessions delivered via `HttpOnly; Secure; SameSite=Strict` cookies.

**Rationale**:
- OWASP Session Management Cheat Sheet provides complete, unambiguous guidance
- Instant revocation: deleting a row immediately invalidates the session
- Zero external dependencies — session ID generated with `crypto.randomBytes(32)`, stored in existing PostgreSQL
- PostgreSQL is already in the stack; a `sessions` table adds no new infrastructure
- JWTs offer no benefit for a single-server app and add revocation complexity
- Magic links were considered but introduce UX friction (open email per login) with no security advantage over password + session for a small-user-base dashboard

**OWASP session requirements implemented**:
- Session ID entropy: `randomBytes(32)` = 256 bits (requirement: 64 bits minimum)
- Session ID regenerated on login and logout
- Cookie flags: `HttpOnly; Secure; SameSite=Strict; Path=/`
- Idle timeout: 30 minutes
- Absolute timeout: 24 hours

---

## Schema Changes

### api_keys table

```sql
-- Before
key VARCHAR(64) NOT NULL UNIQUE  -- plaintext

-- After
key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hex of raw key
hint     CHAR(4)     NOT NULL           -- last 4 chars of raw key, for UI display
```

### users table

```sql
-- Add password field
password_hash VARCHAR(256) NOT NULL  -- scrypt output: "{salt}:{hash}" format
```

### sessions table (new)

```sql
CREATE TABLE sessions (
  id         VARCHAR(64)  PRIMARY KEY,            -- randomBytes(32) hex
  user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## Consequences

### Positive
- Database breach no longer exposes usable API keys or passwords
- Timing attack surface eliminated on API key validation
- Session-based auth provides instant revocation for compromised web sessions
- No new external dependencies introduced
- iOS Shortcuts toggle latency unaffected (~0.1ms hashing overhead)

### Negative
- Existing API keys are plaintext; a migration step must hash them or invalidate and require regeneration (regeneration preferred — simpler and more secure)
- Adds a `sessions` table and session management logic (~80 lines)
- Users must re-enroll with a password (the current email-only enrollment will be replaced)

### Migration Strategy for Existing Keys
Existing plaintext API keys cannot be retroactively hashed without knowing the original value. On deploy:
1. All existing API keys are invalidated
2. Users are prompted to generate new keys through the dashboard
3. New keys are stored as SHA-256 hashes from creation

---

## References

- [Security Research Document](../00004-security-hashing-and-auth-research.md)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js crypto.scrypt documentation](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
- [Node.js crypto.timingSafeEqual documentation](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
