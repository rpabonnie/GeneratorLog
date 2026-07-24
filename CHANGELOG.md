# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This section back-fills the changes shipped since 1.0.0 that had not been recorded, plus the
2026-07-24 security-audit remediation and the wind-down of the (never-merged) MCP exploration.
It is not yet cut as a numbered release.

### Added
- **Web authentication system**: user enrollment, login, logout, and `GET /api/auth/me`, with
  password hashing (scrypt, OWASP parameters) and database-backed sessions (HttpOnly cookies and
  bearer-token support).
- **Password reset flow**: `POST /api/auth/password-reset/request` and `/confirm` with hashed,
  single-use, time-limited tokens; all sessions invalidated on reset. In-app password change
  (`POST /api/auth/password/change`).
- **Frontend web application** (React + Vite SPA): dashboard with generator status and oil-change
  tracking, profile management, API-key management, oil-change history, enrollment and login pages,
  password-reset page, and a run-history bar chart.
- **Responsive design** with multi-breakpoint support and a mobile hamburger navigation; terminal
  visual theme, favicon, and logos; hours/minutes usage formatting.
- **QR code + iOS Shortcut import** for API keys, so an iPhone button can call the toggle endpoint.
- **Email notifications** via nodemailer + Brevo SMTP: maintenance and stop-event alerts, plus a
  maintenance check triggered on settings update and login. SMTP transporter verification at
  startup.
- **Owner enrollment alerts**: `OWNER_EMAIL` is notified (HTML-escaped, fire-and-forget) when a new
  user enrolls, with a corresponding security log entry.
- API endpoints for profile, generator configuration, usage logs, oil-change history, and API-key
  management.

### Changed
- **API key storage hardened**: hashing upgraded to scrypt; raw keys stored encrypted (AES-256-GCM)
  for one-time retrieval/QR display rather than in plaintext.
- Dashboard/toggle now always read fresh generator data to avoid acting on stale in-memory values.
- Node.js runtime aligned to 22 LTS for Azure App Service compatibility; major dependency versions
  upgraded (including Vite 8); Drizzle migrations re-baselined to a single clean baseline and
  snapshot files un-ignored.

### Removed
- GitHub Actions deployment workflow (deployment is now a documented manual zip-deploy).
- Development seed script.
- Unused `@fastify/static` dependency (was never imported; see Security).
- **MCP server integration** — abandoned before merge. See [ADR 0008](docs/adr/0008-abandon-mcp-integration.md).
  No MCP code ever reached `main`; the exploratory research and ADRs 0004–0007 are retained as a
  record and marked superseded. The blocker was the WorkOS AuthKit default (non-custom-domain)
  issuer not serving the OAuth/OIDC discovery metadata Claude's clients require, unresolvable
  without a paid custom domain.

### Fixed
- Oil-change alert bugs: acting on stale generator data, and timezone inconsistency in
  months-since calculations.
- RunBarChart constrained to prevent oversized rendering; SVG viewBox/height corrections.

### Security
- **Dependency vulnerability remediation (2026-07-24)**: cleared 12 advisories (8 high, 4 moderate)
  reported by `pnpm audit`. Removed unused `@fastify/static` (eliminated its Authorization-Bypass
  and path-traversal advisories plus a transitive `brace-expansion` DoS); upgraded `fastify`
  (patched `find-my-way` HTTP/2 DoS and `fast-uri` host-confusion); upgraded `react-router-dom` to
  7.18.1 (patched React Router XSS, open-redirect, DoS, and SSR-hydration constructor-injection);
  added pnpm `overrides` for transitive `shell-quote`, `fast-uri`, `find-my-way`, and
  `brace-expansion`. One advisory remains and is **not applicable**: React Router "RSC Mode CSRF"
  (fixed only in react-router 8.3.0, which is incompatible with the pinned react-router-dom 7.x) —
  the app is a client-only SPA with no React Server Components, so the RSC code path is never used.
- Security hardening from a prior audit: verify database TLS certificates (dropped
  `rejectUnauthorized:false`; `sslmode` in the URL governs); security response headers
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS in production) on the API and
  a `serve.json` Content-Security-Policy + security headers on the frontend; security logging of
  invalid API-key attempts and failed logins; session middleware accepts only 64-hex bearer values;
  fixed a minimatch ReDoS and removed cleartext logging of sensitive values.
- Login is constant-time against user enumeration (dummy scrypt verification when the account does
  not exist). Rate limiting (1 req/s) applied to critical and authentication endpoints.

## [1.0.0] - 2026-02-14

### Added
- Initial release of GeneratorLog
- API endpoint for starting/stopping generator tracking with API key authentication
- Rate limiting middleware (1 request per second)
- Generator toggle endpoint (`POST /api/generator/toggle`)
- Maintenance calculations (hours and months since last oil change)
- Database schema with Drizzle ORM (users, generators, usage_logs, api_keys tables)
- PostgreSQL database integration with migration system
- Comprehensive test suite with 25 tests using TDD approach (Vitest + Playwright)
- Docker containerization for backend deployment
- Cloud deployment support (Azure App Service + Neon PostgreSQL)
- Local deployment support with Docker Compose
- Environment configuration system with .env support
- Health check endpoint (`GET /health`)
- API information endpoint (`GET /`)
- Deployment guides for cloud (Azure) and local server
- Architecture Decision Records (ADR 0001: Technology Stack, ADR 0002: PostgreSQL)
- Research documentation for technology stack, databases, and Azure deployment
- Changelog and versioning system with Keep a Changelog format
- Version synchronization scripts for monorepo

### Infrastructure
- TypeScript + Node.js 26.1.1 backend with Fastify framework
- React + TypeScript frontend with Vite build system
- PostgreSQL 16 database with Drizzle ORM
- pnpm workspace monorepo structure
- Minimal dependencies philosophy (prefer generated code over libraries)

[Unreleased]: https://github.com/rpabonnie/GeneratorLog/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rpabonnie/GeneratorLog/releases/tag/v1.0.0
