# ADR 0001: Adopt TypeScript/Node.js + React Technology Stack

**Date**: 2026-02-08  
**Status**: Accepted  
**Decision Makers**: Development Team  
**Related Research**: [docs/00001-technology-stack-research.md](../00001-technology-stack-research.md)

---

## Context

GeneratorLog is a web service for tracking home power generator usage with automated maintenance reminders. The application requires:

- **API Endpoint**: Single toggle endpoint for generator start/stop tracking (API key authenticated)
- **iOS Integration**: Shortcuts app integration for quick access
- **Web Interface**: Dashboard for configuration, API key management, usage tracking
- **Multi-user Support**: Multiple users with their own generators
- **Email Notifications**: Automated maintenance reminders
- **Security**: Rate limiting (1 req/sec), OAuth2, API key validation, OWASP Top 10 compliance
- **Deployment**: Docker image for cloud or local deployment
- **Data Persistence**: Survives container restarts/updates

### Key Project Constraints

1. **Minimal Dependencies**: Prefer generated code over external libraries
2. **Self-Documenting Code**: Concise, type-safe code with minimal comments
3. **AI Code Generation**: Optimized for AI-assisted development
4. **Token Efficiency**: Reduce AI context window usage

### Development Environment

- **Operating System**: Linux (using fnm as Node version manager)
- **IDE**: VSCode
- **Version Control**: Git/GitHub

---

## Decision

We will use **TypeScript/Node.js with React** as our technology stack:

### Backend
- **Runtime**: Node.js (latest LTS via fnm)
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Fastify 4.x (minimal, fast HTTP framework)
- **Database**: PostgreSQL 16
- **Database Client**: `pg` (raw PostgreSQL client, avoiding heavy ORMs)

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite 5.x (fast, minimal configuration)
- **Language**: TypeScript (strict mode)

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Development**: docker-compose for local development
- **Database Persistence**: Docker volumes or managed PostgreSQL

### Minimal Dependency Approach

Following the project's minimal dependency philosophy, we will:

- **Core Backend Packages** (4-6 total):
  - `fastify` - HTTP server
  - `pg` - PostgreSQL client (no ORM)
  - `typescript` - Type safety
  - `nodemailer` - Email (small, focused library)
  
- **Auth & Security** (custom implementation):
  - JWT validation: 50-100 lines of custom code
  - API key validation: Custom middleware
  - Rate limiting: Simple in-memory Map-based limiter (~20 lines)
  
- **Frontend** (3-4 packages):
  - `react`, `react-dom`
  - `vite`
  - Minimal additional libraries

---

## Rationale

### Why TypeScript/Node.js Over .NET

While the research document recommended .NET 10 for its superior minimal dependency score (10/10 vs TypeScript's 5/10), we chose TypeScript/Node.js based on:

1. **Superior AI Code Generation** (10/10 vs 8/10)
   - TypeScript has the most extensive AI training data
   - Better autocomplete and code suggestions
   - More examples and patterns for AI to reference
   - Critical for an AI-assisted development workflow

2. **Development Velocity**
   - Faster iteration with hot reload
   - No compilation step for development
   - Simpler debugging workflow
   - More accessible to team members

3. **Full-Stack Language Unity**
   - Single language (TypeScript) for frontend and backend
   - Shared types between client and server
   - Reduced context switching
   - Easier code sharing and validation

4. **Mitigation of Dependency Concerns**
   - Can still achieve minimal dependencies with discipline
   - Use `pg` instead of Prisma (no ORM bloat)
   - Use Fastify instead of Express/Next.js (lighter)
   - Write custom auth/rate limiting code
   - Target: 6-8 packages vs .NET's 1-2 (acceptable trade-off)

### Why React for Frontend

- **Ecosystem**: Largest component library and community
- **AI Training Data**: Excellent AI code generation support
- **Vite**: Fast build tool with minimal configuration
- **Flexibility**: Can easily integrate with backend API
- **Type Safety**: Full TypeScript integration

### Why Fastify Over Alternatives

- **Performance**: Faster than Express, competitive with Go
- **TypeScript-First**: Excellent TypeScript support
- **Minimal**: Lighter than NestJS or Next.js
- **Plugin System**: Add only what you need

### Why pg Over Prisma

- **Minimal Dependencies**: Prisma adds significant package bloat
- **Control**: Direct SQL queries for clarity
- **Performance**: No ORM overhead
- **Transparency**: SQL is visible and auditable

---

## Consequences

### Positive

✅ **Excellent AI Assistance**: Best-in-class code generation and suggestions  
✅ **Type Safety**: TypeScript prevents many runtime errors  
✅ **Fast Development**: Hot reload, quick iterations  
✅ **Single Language**: JavaScript/TypeScript everywhere  
✅ **Rich Ecosystem**: Solutions available for all requirements  
✅ **Modern Tooling**: Vite, ESBuild for fast builds  
✅ **Container-Friendly**: Good Docker support with alpine images  

### Negative

⚠️ **More Dependencies Than .NET**: 6-8 packages vs 1-2 (requires discipline)  
⚠️ **Performance**: Slightly slower than .NET/Go (but adequate)  
⚠️ **Memory Usage**: Higher than compiled languages  
⚠️ **Runtime Errors**: Possible despite TypeScript (requires good testing)  

### Mitigation Strategies

1. **Dependency Management**:
   - Regular audits of package.json
   - Prefer custom code for simple tasks (rate limiting, validation)
   - No ORMs - use raw SQL with `pg`
   - No heavy frameworks - keep it minimal

2. **Code Quality**:
   - Strict TypeScript configuration
   - Self-documenting variable/function names
   - Minimal comments (code should be obvious)

3. **Performance**:
   - Use Fastify (one of fastest Node.js frameworks)
   - Optimize critical paths if needed
   - Consider caching strategies
   - Docker multi-stage builds for small images

---

## Implementation Plan

### Phase 1: Backend Setup
1. Initialize TypeScript project with Fastify
2. Configure PostgreSQL connection with `pg`
3. Implement API key authentication (custom)
4. Implement rate limiting (custom in-memory)
5. Create generator toggle endpoint
6. Add security logging

### Phase 2: Frontend Setup
1. Initialize React + Vite project
2. Create dashboard UI
3. Add API key management interface
4. Build usage history views
5. Implement configuration screens

### Phase 3: Infrastructure
1. Create Docker multi-stage build
2. Set up docker-compose for development
3. Configure environment variables
4. Set up database migrations (raw SQL)

### Phase 4: Integration
1. Email notifications (nodemailer)
2. iOS Shortcuts integration
3. OAuth2 for web interface
4. Production deployment configuration

---

## Alternatives Considered

### Option 1: .NET 10 (Recommended in Research)
- **Pros**: Minimal dependencies (1-2 packages), built-in features, excellent performance
- **Cons**: Less AI training data, two-language stack if using React, steeper learning curve
- **Why Rejected**: AI code generation quality is critical for our workflow

### Option 2: Go
- **Pros**: Best performance, smallest Docker images, minimal dependencies (2-3 packages)
- **Cons**: Verbose code, less AI training data, two-language stack, slower development
- **Why Rejected**: Development velocity and AI assistance more important than raw performance

### Option 3: Python/FastAPI
- **Pros**: Good AI support, automatic API docs, simple syntax
- **Cons**: Two-language stack, slower than Node.js, frontend separation
- **Why Rejected**: TypeScript provides better full-stack integration

---

## Review Schedule

This decision should be reviewed:
- After MVP completion (to assess dependency count and maintainability)
- If performance becomes a bottleneck (consider Go or .NET migration)
- If dependency management becomes problematic (consider .NET migration)
- Annually or when major new requirements emerge

---

## References

- [Technology Stack Research](../00001-technology-stack-research.md)
- [Fastify Documentation](https://fastify.dev)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten)
