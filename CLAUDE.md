# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeneratorLog - A web service for tracking home power generator usage with automated maintenance reminders.

**License**: MIT
**Author**: Ray Pabonnie

### Purpose
Track when a home power generator is started and stopped, calculate running hours, and send automated email reminders for oil changes based on:
- Configured running hours threshold, OR
- Configured months since last oil change (whichever happens first)

### Core Features
- **API Endpoint**: Single toggle endpoint for starting/stopping generator tracking (authenticated via API key)
- **iOS Integration**: Shortcuts app integration for quick start/stop via iPhone button
- **Web Interface**: Dashboard for:
  - Configuring generator parameters
  - Managing API keys (create, reset)
  - Manually editing generator usage entries
  - Viewing usage history and statistics
- **Multi-user Support**: Multiple users with their own generators
- **Email Notifications**: Automated maintenance reminders
- **Security**: Rate limiting (1 req/sec), OAuth2, API key validation, security logging per OWASP Top 10

### Technical Requirements
- **Deployment**: Docker image for easy deployment to any Docker cloud or local repository
- **Data Persistence**: Survives container restarts/updates
- **Rate Limiting**: Maximum 1 API call per second
- **Security Logging**: Log all incorrect API key attempts with alerts
- **Authentication**: API keys for device calls, OAuth2 for web interface
- **MVP Scope**: Single generator per user
- **Minimal Dependencies**: Prefer generated code over external libraries
- **Code Quality**: Concise, self-documenting code to minimize token usage and comments

### Deployment Architecture (Decided)

**Database**: PostgreSQL (see ADR 0002)
- **Cloud deployment**: Neon PostgreSQL free tier (beta) → Azure Database for PostgreSQL B1ms (production)
- **Local deployment**: User-provided PostgreSQL server (self-hosted or Docker Compose)
- **Reason**: Multi-user concurrent access, cloud reliability, cost optimization

**Container Strategy**: Single container
- Backend API (TypeScript/Node.js + Fastify)
- No separate database container in cloud (use managed PostgreSQL)
- Local development uses Docker Compose with PostgreSQL

**Deployment Targets**:
1. **Cloud (Beta)**: Azure App Service F1 Free + Neon PostgreSQL Free ($0/month)
2. **Cloud (Production)**: Azure App Service B1 + Neon/Azure PostgreSQL ($13-30/month)
3. **Local Server**: Docker container + user-provided PostgreSQL (self-hosted)

### Environment Configuration

**Required Environment Variables**:
```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# API configuration
API_RATE_LIMIT=1  # requests per second
NODE_ENV=production

# Email configuration (for maintenance reminders)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
SMTP_FROM=noreply@generatorlog.com

# OAuth2 configuration (for web interface)
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://your-domain.com/auth/callback

# Session secrets
SESSION_SECRET=random-secret-key
```

### Key Technical Questions to Address
- ~~Database persistence strategy outside Docker containers~~ ✅ RESOLVED (PostgreSQL, see ADR 0002)
- ~~Single vs multi-container Docker architecture~~ ✅ RESOLVED (Single container + managed DB)
- iOS Shortcuts file generation and import methods (QR code?)
- OAuth2 implementation approach

## Repository Status

This is a new repository with minimal structure. As the project develops, this file should be updated with:
- Build and test commands
- Code architecture and patterns
- Development workflow and conventions
- Key entry points and module structure

## Coding Guidelines

### Dependency Philosophy
- **Minimize external dependencies**: Only add a library if writing the code would take significant effort
- **Prefer built-in features**: Use standard library/framework features over third-party packages
- **Generate custom code**: For simple tasks (rate limiting, validation, etc.), write 50-100 lines instead of adding a dependency
- **Acceptable dependencies**: Database drivers, micro-ORMs (Dapper), security libraries (if complex)
- **Avoid heavy frameworks**: No Prisma, Entity Framework Core, massive auth frameworks - write focused code instead

### Code Quality Standards
- **Self-documenting code**: Strong typing, descriptive names, clear structure
- **Minimize comments**: Code should be obvious. Comments only for complex business logic
- **Token efficiency**: Concise code reduces AI context window usage
- **Type safety first**: Leverage compiler for correctness (C# records, nullable reference types, TypeScript strict mode)
- **TDD preferred**: Start with a failing test, make it pass, and keep the suite green
- **KISS principle**: Simple solutions over clever abstractions
- **No premature abstraction**: Write it once, refactor when you need it twice

### Language-Specific Guidance
If using **.NET/C#**:
- Use Minimal APIs for concise endpoints
- C# records for immutable data models
- Nullable reference types enabled
- LINQ for readable queries
- Built-in dependency injection
- **Only external packages**: Npgsql, Dapper (optional)

If using **TypeScript/Node.js** (SELECTED):
- Node.js 25.6.1
- Fastify (not Express or Next.js)
- `pg` client for PostgreSQL
- Drizzle ORM (lightweight, type-safe, minimal abstraction)
- Zod for runtime validation
- Custom auth/rate limiting utilities
- TypeScript strict mode enabled
- **External packages**: fastify, pg, drizzle-orm, zod, typescript, nodemailer (maybe)

If using **Go**:
- Standard library for HTTP, JSON, SMTP
- `pgx` for PostgreSQL
- Write middleware from scratch
- **Only external packages**: pgx, golang-jwt (optional)

## Testing

- Backend unit tests (Vitest): `pnpm --filter generatorlog-backend test` (watch: `pnpm --filter generatorlog-backend test:watch`)
- Frontend end-to-end (Playwright): `pnpm --filter frontend test:e2e` (UI runner: `pnpm --filter frontend test:e2e:ui`)
- Install Playwright browsers once per machine: `pnpm --filter frontend exec playwright install chromium`
- Keep tests passing on every change; add/adjust tests before implementing features.

### Test Failure Investigation Protocol

**CRITICAL: When tests fail, ALWAYS investigate the test itself before modifying or removing it.**

Before making any changes to a failing test:

1. **Read the test code** to understand what it's testing
2. **Read the implementation** being tested
3. **Analyze the failure** - determine if the issue is:
   - **Test bug**: The test has incorrect expectations or setup issues
   - **Implementation bug**: The code being tested has a bug
   - **Environment issue**: Local environment configuration (e.g., .env files affecting tests)
   - **Timing/timezone issue**: Date/time tests affected by local timezone or system clock

4. **Common test issues to check for**:
   - `.env` files being loaded by `dotenv/config` that override test expectations
   - Date parsing with implicit timezone conversion (use `Date.UTC()` for consistent dates)
   - Async operations not properly awaited
   - Module caching preventing test isolation (use `vi.resetModules()`)
   - External dependencies not mocked

5. **Document your findings** - explain WHY the test is failing and WHY your fix is correct

**NEVER**:
- Skip or comment out failing tests without investigation
- Modify test expectations to match incorrect behavior without understanding why
- Remove tests because they're "flaky" without root cause analysis

**Example Investigation**:
```
Test failure: config.test.ts expects SESSION_SECRET='change-this-secret' but got random value
Root cause: dotenv/config loads .env file before test runs, setting SESSION_SECRET
Solution: Save and restore env values in test, or check if .env should be excluded from test runs
```

## Changelog and Versioning

### Version Management

This project uses **unified versioning** across the monorepo:
- **Single version number**: Root `package.json` version applies to backend and frontend
- **Single changelog**: `CHANGELOG.md` at repository root documents all changes
- **Semantic versioning**: We follow [SemVer 2.0.0](https://semver.org/)
  - **MAJOR** (x.0.0): Breaking changes, incompatible API changes
  - **MINOR** (1.x.0): New features, backwards-compatible functionality
  - **PATCH** (1.0.x): Bug fixes, backwards-compatible fixes

### When to Update the Changelog

**ALWAYS** ask the developer before updating the changelog. Use this workflow:

1. **After implementing changes**: Ask "Are you ready to update the changelog for these changes?"
2. **Wait for confirmation**: Do NOT update changelog without explicit approval
3. **Collect all changes**: If multiple changes were made, list them all for review
4. **Categorize properly**: Suggest appropriate categories (Added, Changed, Fixed, etc.)

### Agent Workflow for Changelog Updates

When the developer confirms changelog updates are ready:

**Step 1: Analyze Changes**
```bash
# Review recent commits since last release
git log v1.0.0..HEAD --oneline

# Check current version
cat package.json | grep version

# Review current changelog
cat CHANGELOG.md
```

**Step 2: Ask Developer for Categorization**

Present changes and ask:
- "I found these changes: [list]. How should I categorize them?"
- "Should this be a patch (1.0.1), minor (1.1.0), or major (2.0.0) release?"
- "What release date should I use? (default: today)"

**Step 3: Update CHANGELOG.md**

Add changes under the `## [Unreleased]` section:

```markdown
## [Unreleased]

### Added
- New feature X that does Y
- New endpoint `/api/something` for Z functionality

### Changed
- Updated configuration format for better readability
- Improved error messages in API responses

### Fixed
- Bug where generator wouldn't stop correctly
- Rate limiter memory leak issue
```

**Step 4: Version Bump (When Releasing)**

When developer says "let's release this":

```bash
# For patch release (1.0.0 -> 1.0.1)
pnpm version:patch

# For minor release (1.0.0 -> 1.1.0)
pnpm version:minor

# For major release (1.0.0 -> 2.0.0)
pnpm version:major
```

**Step 5: Move Unreleased to Versioned Section**

Transform:
```markdown
## [Unreleased]

### Added
- Feature X
```

Into:
```markdown
## [Unreleased]

### Added

## [1.1.0] - 2026-02-15

### Added
- Feature X
```

Add link at bottom:
```markdown
[Unreleased]: https://github.com/rpabonnie/GeneratorLog/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/rpabonnie/GeneratorLog/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rpabonnie/GeneratorLog/releases/tag/v1.0.0
```

**Step 6: Verify Synchronization**

```bash
# Check all versions match
grep version package.json backend/package.json frontend/package.json
```

### Changelog Categories

Use these categories in order (omit empty sections):

- **Added**: New features, endpoints, functionality
- **Changed**: Changes to existing functionality, refactoring, improvements
- **Deprecated**: Features marked for future removal
- **Removed**: Removed features or functionality
- **Fixed**: Bug fixes, corrections
- **Security**: Security fixes, vulnerability patches

### Important Rules for Agents

1. **NEVER update changelog without developer approval**
2. **NEVER create a release without developer approval**
3. **ALWAYS synchronize all package.json versions** (use `pnpm version:sync`)
4. **ALWAYS use Keep a Changelog format** (see https://keepachangelog.com/)
5. **ALWAYS use ISO date format** (YYYY-MM-DD) for release dates
6. **ALWAYS update comparison links** at bottom of CHANGELOG.md
7. **DO NOT include trivial changes** (typos in comments, formatting, unless fixing user-facing issues)
8. **DO include all user-facing changes** (API changes, new features, bug fixes, behavior changes)

### Example: Complete Changelog Update Workflow

**Developer:** "I've finished the email notification feature. Can you update the changelog?"

**Agent Response:**
```
I see you've completed the email notification feature. Let me review what was added:

Changes identified:
- New email service (src/services/email.ts)
- SMTP configuration in .env
- Maintenance reminder scheduling
- 3 new tests for email functionality

Suggested changelog entry under "Added":
- Email notification service for automated maintenance reminders
- SMTP configuration support for email delivery
- Maintenance reminder scheduling based on running hours and months

Should I add this to the [Unreleased] section? This looks like a minor version bump (1.0.0 -> 1.1.0) since it adds new functionality. Is that correct?
```

**Developer:** "Yes, add it to unreleased. We'll release later."

**Agent:** Updates CHANGELOG.md under `## [Unreleased]` > `### Added` section.

### Version Sync Troubleshooting

If versions are out of sync:

```bash
# Check current versions
grep '"version"' package.json backend/package.json frontend/package.json

# Manual sync (if sync script fails)
# 1. Read version from root package.json
# 2. Update backend/package.json version field
# 3. Update frontend/package.json version field
# 4. Verify all match
```

### Release Checklist

When creating a new release:

- [ ] All tests passing (`pnpm test` and `pnpm test:e2e`)
- [ ] CHANGELOG.md updated with all changes
- [ ] Version bumped in all package.json files (via `pnpm version:*`)
- [ ] Changes moved from [Unreleased] to versioned section with date
- [ ] Comparison links updated at bottom of CHANGELOG.md
- [ ] Git tag created (`git tag v1.1.0`)
- [ ] Changes committed (`git commit -m "chore: release v1.1.0"`)
- [ ] Tag pushed to remote (`git push && git push --tags`)

## Research instructions
- When the user asks for a research, look for at least 4 ideas/products/libraries/etc.
- Compare each found concept's strengths and weaknesses.
- Save your findings in the `docs/` directory with the filename format `00000-subject-research.md` as a markdown file.
- One the user chooses anyone of the related choices or whatever the user chooses specifically about the research subject, create an ADR (Architectural Decision Document) and save it on the subfolder `adr/` of the `docs/` directory, create the adr subdirectory if it doesn't exists.
- Always give the best recommendation taking into account that this repository will be mostly using AI generated code and agents.
- **Prioritize minimal dependencies and self-documenting code** in all recommendations.
