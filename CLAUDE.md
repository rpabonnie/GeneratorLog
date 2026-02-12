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

## Testing & TDD

- Use TDD: add a failing test first, make it pass, then refactor with tests green.
- Unit/integration: Vitest in the backend (`pnpm test:watch` locally, `pnpm test:unit`, `pnpm test:coverage`).
- End-to-end: Playwright runs against the Vite dev server on http://localhost:4173 (`pnpm test:e2e` spins it up automatically).

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
- Node.js 25.2.1
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

## Research instructions
- When the user asks for a research, look for at least 4 ideas/products/libraries/etc.
- Compare each found concept's strengths and weaknesses.
- Save your findings in the `docs/` directory with the filename format `00000-subject-research.md` as a markdown file.
- One the user chooses anyone of the related choices or whatever the user chooses specifically about the research subject, create an ADR (Architectural Decision Document) and save it on the subfolder `adr/` of the `docs/` directory, create the adr subdirectory if it doesn't exists.
- Always give the best recommendation taking into account that this repository will be mostly using AI generated code and agents.
- **Prioritize minimal dependencies and self-documenting code** in all recommendations.
