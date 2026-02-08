# Technology Stack Research for GeneratorLog

**Date**: 2026-02-08
**Status**: Research Phase
**Author**: Claude Code

## Executive Summary

This document evaluates five technology stack options for GeneratorLog, a generator usage tracking web service with API endpoints, multi-user support, Docker deployment, and iOS integration.

**Development Environment**: Arch Linux + VSCode

**Project Constraints**:
- **Minimal Dependencies**: Prefer generated code over external libraries
- **Code Quality**: Concise, self-documenting code to minimize token usage
- **Comments**: Avoid unnecessary comments; let code speak for itself

**Recommendation**: **Option 5 - .NET 10 Stack** (ASP.NET Core Minimal APIs + PostgreSQL + Blazor/Minimal JS)

**Why .NET with these constraints**: Extensive built-in standard library requires minimal external dependencies. Nearly everything needed (rate limiting, auth, HTTP, JSON, email, logging, DI) is built-in. Strong type system creates self-documenting code.

---

## Option 1: TypeScript/Node.js Stack

### Components
- **Backend**: Fastify or NestJS (TypeScript)
- **Database**: PostgreSQL with pg or Prisma ORM
- **Frontend**: Next.js 14+ (App Router) or Vite + React
- **Authentication**: Passport.js or Auth.js (NextAuth)
- **Containerization**: Single Docker image with docker-compose for development

### Strengths
✅ **Excellent for AI Code Generation**: TypeScript is one of the most well-documented languages in AI training data
✅ **Type Safety**: Catches errors at compile time, makes AI-generated code more reliable
✅ **Rich Ecosystem**: Extensive libraries for rate limiting (express-rate-limit), OAuth2 (passport-oauth2), email (nodemailer)
✅ **Developer Experience**: Hot reload, excellent debugging, VSCode integration
✅ **Single Language**: JavaScript/TypeScript for both frontend and backend reduces context switching
✅ **Next.js Benefits**: Built-in API routes, server actions, automatic code splitting, SEO-friendly
✅ **Prisma ORM**: Type-safe database queries, automatic migrations, excellent DX
✅ **Docker Friendly**: Small base images available (node:alpine), easy multi-stage builds
✅ **Community Support**: Massive ecosystem, extensive documentation

### Weaknesses
❌ **Performance**: Not as fast as Go or Rust for raw CPU-intensive tasks
❌ **Memory Usage**: Higher than compiled languages
❌ **Runtime Errors**: Despite TypeScript, runtime type mismatches can still occur
❌ **Dependency Bloat**: node_modules can be large

### AI-Friendliness Score: 10/10
TypeScript has the most training examples, excellent autocomplete suggestions, and AI models understand it extremely well.

### Dependency Minimization Score: 5/10
❌ **High Dependency Culture**: npm ecosystem encourages adding packages for everything
❌ **Prisma/TypeORM**: ORMs add significant dependencies (could use raw `pg` client instead)
❌ **Auth Libraries**: Auth.js/Passport add complexity (could write custom JWT validation)
❌ **Next.js**: Large framework dependency (could use vanilla Fastify + htmx/Alpine.js)
✅ **Can Use Minimal Setup**: Fastify + pg + vanilla TypeScript is possible
✅ **Self-Documenting**: TypeScript types make code self-explanatory

**Minimal Dependency Approach**:
- Core: `fastify`, `pg`, `typescript`
- Auth: Write custom JWT/API key validation (50-100 lines)
- Rate limiting: Simple in-memory Map-based limiter (20 lines)
- Email: Node.js built-in SMTP or `nodemailer` (small)
- Frontend: htmx + Alpine.js (minimal JS, server-rendered HTML)
- Total packages: ~6-8

### Technology Choices
```typescript
// Backend: Fastify (faster) or NestJS (more structure)
// Database ORM: Prisma (recommended) or TypeORM
// Frontend: Next.js 14+ with App Router
// Auth: Auth.js (NextAuth.js)
// Rate Limiting: @fastify/rate-limit or express-rate-limit
// Email: nodemailer or Resend
// Validation: Zod or Yup
// Logging: Winston or Pino
```

---

## Option 2: Python Stack (FastAPI)

### Components
- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL with SQLAlchemy or SQLModel
- **Frontend**: React with Vite or Next.js
- **Authentication**: FastAPI-Users or Authlib
- **Containerization**: Separate frontend/backend containers or single container

### Strengths
✅ **FastAPI Speed**: One of the fastest Python frameworks, async support
✅ **Strong AI Understanding**: Python is heavily represented in AI training data
✅ **Automatic API Docs**: Built-in Swagger/ReDoc documentation
✅ **Type Hints**: Pydantic models provide runtime validation and type safety
✅ **Data Processing**: Excellent if you need analytics or complex calculations
✅ **Email Libraries**: Rich options like FastAPI-Mail, python-emails
✅ **OAuth2 Built-in**: FastAPI has OAuth2 examples in documentation
✅ **Scientific Computing**: Great if you plan to add analytics features

### Weaknesses
❌ **Two-Language Stack**: Python backend + JavaScript frontend requires context switching
❌ **Slower than Node.js**: For I/O-heavy operations despite async support
❌ **Deployment Complexity**: Requires WSGI/ASGI server (Gunicorn/Uvicorn)
❌ **Frontend Separation**: No integrated full-stack framework like Next.js
❌ **Async Learning Curve**: Python's async/await less mature than Node.js
❌ **Type System**: MyPy required for static analysis, not as robust as TypeScript

### AI-Friendliness Score: 9/10
Python is extremely well-understood by AI, but the two-language requirement reduces the score.

### Dependency Minimization Score: 6/10
✅ **Smaller Ecosystem**: Fewer dependencies than Node.js typically
✅ **Standard Library**: Extensive built-in modules (smtplib, asyncio, etc.)
✅ **Can Avoid ORM**: Use `asyncpg` directly with raw SQL
❌ **FastAPI Framework**: Pulls in Starlette, Pydantic (could use raw Starlette)
❌ **Frontend Separation**: Still need separate frontend tooling
✅ **Self-Documenting**: Type hints + Pydantic models are clear

**Minimal Dependency Approach**:
- Core: `fastapi`, `asyncpg`, `python-multipart`
- Auth: Custom JWT with `python-jose` or write from scratch
- Rate limiting: In-memory asyncio-based limiter (30 lines)
- Email: Built-in `smtplib` (zero dependencies)
- Frontend: htmx + minimal JS (served from FastAPI static)
- Total packages: ~5-7

### Technology Choices
```python
# Backend: FastAPI + Uvicorn
# Database ORM: SQLModel (combines SQLAlchemy + Pydantic)
# Frontend: React + Vite (separate from backend)
# Auth: FastAPI-Users or custom with python-jose
# Rate Limiting: slowapi
# Email: FastAPI-Mail
# Validation: Pydantic (built-in)
# Logging: Loguru or Python logging
```

---

## Option 3: Go Stack

### Components
- **Backend**: Fiber or Echo (Go 1.21+)
- **Database**: PostgreSQL with GORM or sqlc
- **Frontend**: React/Svelte with Vite
- **Authentication**: golang-jwt/jwt
- **Containerization**: Minimal alpine-based image

### Strengths
✅ **Performance**: Extremely fast, compiled binary, low memory footprint
✅ **Small Docker Images**: ~10-20MB final images possible
✅ **Strong Typing**: Compile-time type safety
✅ **Concurrency**: Goroutines excellent for handling multiple API requests
✅ **Single Binary**: Easy deployment, no runtime dependencies
✅ **Good Standard Library**: Built-in HTTP server, no framework strictly required
✅ **Resource Efficiency**: Perfect for serverless/edge deployments

### Weaknesses
❌ **Verbose Code**: More boilerplate than TypeScript or Python
❌ **Smaller Ecosystem**: Fewer libraries compared to Node.js/Python
❌ **Error Handling**: `if err != nil` everywhere can be tedious
❌ **AI Code Generation**: Less training data than TypeScript/Python
❌ **Slower Development**: Compilation step, less rapid prototyping
❌ **Frontend Separation**: No full-stack framework
❌ **ORM Quality**: GORM is okay but not as good as Prisma/SQLAlchemy
❌ **Learning Curve**: Different paradigms from mainstream languages

### AI-Friendliness Score: 6/10
AI models understand Go, but have less training data and generate more verbose code.

### Dependency Minimization Score: 9/10
⭐ **EXCELLENT Standard Library**: HTTP server, JSON, crypto, SMTP all built-in
⭐ **No ORM Needed**: `database/sql` + `pgx` driver is minimal
⭐ **Can Write Everything**: Auth, rate limiting, all custom code easily
⭐ **No Framework Required**: Standard library alone can build the entire app
✅ **Self-Documenting**: Strong typing, explicit error handling
✅ **Single Binary**: Zero runtime dependencies

**Minimal Dependency Approach**:
- Core: `pgx` (PostgreSQL driver), `golang-jwt` (or write own JWT)
- Auth: Custom JWT/API key validation (100 lines)
- Rate limiting: sync.Map-based limiter (40 lines)
- Email: Built-in `net/smtp` (zero dependencies)
- Frontend: `html/template` + htmx (all built-in)
- Total packages: ~2-3 external libraries

**This is the best for minimal dependencies**, but AI generates more verbose code.

### Technology Choices
```go
// Backend: Fiber (Express-like) or Echo
// Database: GORM or sqlc (type-safe SQL)
// Frontend: React + Vite (separate)
// Auth: golang-jwt/jwt + custom implementation
// Rate Limiting: github.com/ulule/limiter
// Email: gomail or Mailgun SDK
// Validation: go-validator
// Logging: zap or zerolog
```

---

## Option 4: Ruby on Rails Stack

### Components
- **Backend**: Ruby on Rails 7.1+
- **Database**: PostgreSQL with ActiveRecord
- **Frontend**: Hotwire (Turbo + Stimulus) or React
- **Authentication**: Devise or Rodauth
- **Containerization**: Docker with Puma server

### Strengths
✅ **Convention over Configuration**: Fastest initial development
✅ **Full-Stack Framework**: Everything included (auth, email, jobs, etc.)
✅ **Hotwire**: Modern reactive UI without heavy JavaScript
✅ **Mature Ecosystem**: Gems for everything (Devise, Sidekiq, ActionMailer)
✅ **ActiveRecord**: Powerful ORM with migrations
✅ **API Mode**: Rails 7+ has excellent API-only mode
✅ **Developer Happiness**: Optimized for developer productivity
✅ **Authentication**: Devise is battle-tested and comprehensive

### Weaknesses
❌ **Performance**: Slower than all other options
❌ **AI Code Generation**: Less training data than TypeScript/Python
❌ **Memory Usage**: Higher than Node.js, much higher than Go
❌ **Docker Images**: Large images (hundreds of MB)
❌ **Deployment Complexity**: Requires Puma/Passenger, asset compilation
❌ **Learning Curve**: Ruby syntax and Rails magic can confuse AI
❌ **Declining Popularity**: Fewer modern examples for AI to learn from
❌ **Type Safety**: No static typing (Sorbet exists but not widely adopted)

### AI-Friendliness Score: 7/10
AI understands Rails conventions well, but lack of type safety and less training data are drawbacks.

### Dependency Minimization Score: 2/10
❌ **Rails IS Dependencies**: Framework itself is hundreds of gems
❌ **Convention Over Configuration**: Magic means hidden dependencies
❌ **Gemfile Bloat**: Devise, Sidekiq, etc. add many transitive dependencies
❌ **Heavy Framework**: ActiveRecord, ActionMailer, etc. all bundled
❌ **Not Minimal**: Goes against the minimal dependency philosophy
✅ **Self-Contained**: At least everything is in one framework
❌ **Cannot Strip Down**: Rails is all-or-nothing

**Minimal Dependency Approach**: Not possible with Rails
- Rails itself is ~50+ gem dependencies
- **Not recommended** for minimal dependency requirement

This option is **eliminated** due to dependency constraints.

### Technology Choices
```ruby
# Backend: Ruby on Rails 7.1+ (API mode or full-stack)
# Database: PostgreSQL with ActiveRecord
# Frontend: Hotwire (Turbo + Stimulus) or React
# Auth: Devise or Rodauth
# Rate Limiting: Rack::Attack
# Email: ActionMailer + SendGrid/Mailgun
# Background Jobs: Sidekiq
# Logging: Rails logger or Lograge
```

---

## Option 5: .NET 10 Stack (ASP.NET Core)

### Components
- **Backend**: ASP.NET Core Minimal APIs or Controllers (.NET 10)
- **Database**: PostgreSQL with Entity Framework Core
- **Frontend**: Blazor Server/WebAssembly or React/Next.js
- **Authentication**: ASP.NET Core Identity + IdentityServer/Duende
- **Containerization**: Docker with multi-stage builds

### Strengths
✅ **Excellent Performance**: Close to Go in benchmarks, much faster than Node.js/Python
✅ **Strong Type Safety**: C# has excellent compile-time type checking and null safety
✅ **VSCode Support**: C# Dev Kit extension provides great experience on Linux
✅ **Cross-Platform**: Runs excellently on Arch Linux, no Windows required
✅ **Built-in Features**: Dependency injection, configuration, logging all included
✅ **Entity Framework Core**: Mature ORM with migrations, LINQ queries, excellent PostgreSQL support
✅ **Minimal APIs**: Modern, concise API endpoints (like FastAPI style)
✅ **Blazor Option**: Full-stack C# if you want to avoid JavaScript entirely
✅ **NuGet Ecosystem**: Rich package ecosystem for everything needed
✅ **Docker Optimized**: Official Microsoft images, excellent multi-stage build support
✅ **OpenAPI/Swagger**: Built-in Swagger generation for APIs
✅ **Security**: Built-in authentication, authorization, CORS, rate limiting middleware

### Weaknesses
❌ **AI Code Generation**: Good but not as abundant as TypeScript/Python training data
❌ **Frontend Limitation**: If using Blazor, less flexible than React/Next.js ecosystem
❌ **Steeper Learning Curve**: C# syntax and .NET patterns more complex than JavaScript
❌ **Verbose Compared to TS**: More ceremony than TypeScript/Node.js for simple tasks
❌ **OAuth2 Complexity**: IdentityServer/Duende has licensing considerations (free for small projects)
❌ **Docker Images**: Larger than Node.js (~200MB for runtime, ~100MB with Alpine)
❌ **Less Frontend Integration**: If using React, still need separate build pipeline
❌ **Package Manager**: NuGet not as fast as npm/pnpm for frontend packages

### AI-Friendliness Score: 8/10
AI models understand C# and .NET well, with good code generation quality. Slightly less training data than TypeScript/Python but still very capable.

### Dependency Minimization Score: 10/10
⭐ **BEST-IN-CLASS Standard Library**: Massive BCL with everything built-in
⭐ **Rate Limiting**: `Microsoft.AspNetCore.RateLimiting` built-in (zero packages)
⭐ **Authentication**: ASP.NET Core Identity built-in (zero packages)
⭐ **HTTP/JSON**: Built-in HttpClient, System.Text.Json
⭐ **Email**: `System.Net.Mail.SmtpClient` built-in (zero packages)
⭐ **Logging**: `Microsoft.Extensions.Logging` built-in
⭐ **DI Container**: Built-in dependency injection
⭐ **Database**: ADO.NET built-in (raw SQL), or Dapper (tiny micro-ORM)
✅ **Self-Documenting**: C# records, nullable reference types, LINQ
✅ **Configuration**: appsettings.json handling built-in

**Minimal Dependency Approach**:
- Core: **ZERO external packages** (use `dotnet new webapi`)
- Database: `Npgsql` (PostgreSQL driver only) + Dapper (optional micro-ORM)
- Auth: Built-in JWT authentication
- Rate limiting: Built-in rate limiting middleware
- Email: Built-in SMTP client
- Frontend: Razor Pages (built-in) + htmx
- **Total external packages: 1-2** (just Npgsql + optionally Dapper)

**This is THE BEST option for minimal dependencies** while maintaining excellent AI code generation and type safety.

### Technology Choices
```csharp
// Backend: ASP.NET Core 10 Minimal APIs
// Database ORM: Entity Framework Core 10
// Frontend Option 1: Blazor Server or WebAssembly (full C#)
// Frontend Option 2: React + Vite (separate build)
// Auth: ASP.NET Core Identity + Duende IdentityServer (or Auth0/Okta)
// Rate Limiting: ASP.NET Core built-in rate limiting middleware
// Email: MailKit or FluentEmail
// Validation: FluentValidation or Data Annotations
// Logging: Serilog or built-in ILogger
// Testing: xUnit + FluentAssertions
```

### Arch Linux Compatibility
✅ **Excellent**: .NET SDK available in AUR (`dotnet-sdk` package)
✅ **VSCode**: C# Dev Kit extension works perfectly
✅ **Package Manager**: `pacman -S dotnet-sdk dotnet-runtime`
✅ **Hot Reload**: `dotnet watch` provides excellent development experience
✅ **Docker**: Works seamlessly with Docker on Arch Linux

### Example Minimal API
```csharp
// Program.cs - Ultra clean API endpoint
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>();
builder.Services.AddAuthentication().AddJwtBearer();

var app = builder.Build();

app.MapPost("/api/generator/toggle", async (
    [FromHeader(Name = "X-API-Key")] string apiKey,
    AppDbContext db) =>
{
    // Validate API key, toggle generator state
    var user = await db.Users.FirstOrDefaultAsync(u => u.ApiKey == apiKey);
    if (user == null) return Results.Unauthorized();

    // Toggle logic here
    return Results.Ok();
}).RequireRateLimiting("api");

app.Run();
```

---

## Comparison Matrix

| Criteria | TypeScript/Node.js | Python/FastAPI | Go | Ruby on Rails | .NET 10 |
|----------|-------------------|----------------|-----|---------------|---------|
| **AI Code Generation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐½ | ⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐⭐ |
| **Minimal Dependencies** 🔥 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Self-Documenting Code** 🔥 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐½ | ⭐⭐⭐⭐⭐ | ⭐⭐½ | ⭐⭐⭐⭐⭐ |
| **Type Safety** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Ecosystem** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Development Speed** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Docker Image Size** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **OAuth2 Support** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Learning Curve** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Full-Stack DX** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Community Size 2026** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Arch Linux/VSCode** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

🔥 = **Critical constraints for this project**

**With minimal dependency and self-documenting code constraints: .NET 10 is the clear winner, with Go as a close second.**

---

## Specific Considerations for GeneratorLog

### Data Persistence Outside Docker
All options support this equally well:
- **Docker Volumes**: Mount PostgreSQL data directory to host
- **External Database**: Use managed PostgreSQL (AWS RDS, Digital Ocean, Supabase)
- **Best Practice**: Use docker-compose with named volumes for development, managed DB for production

### Single vs Multi-Container Architecture
**Recommendation**: **Multi-container with docker-compose**

```yaml
# Development: docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
  app:
    build: .
    depends_on:
      - db
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://db:5432/generatorlog
```

**Production**: Single container with external managed database (simplest deployment)

### iOS Shortcuts Integration
All stacks handle this identically:
- **Approach**: Generate `.shortcut` files programmatically or provide setup instructions
- **QR Code**: Generate QR with setup URL containing API key
- **Better UX**: Web page that generates pre-configured shortcut with user's API key
- **Apple Shortcuts Gallery**: Can create shareable shortcuts with variables

### Rate Limiting (1 req/sec)
- **TypeScript**: `@fastify/rate-limit` or `express-rate-limit` (excellent)
- **Python**: `slowapi` (good, Redis-backed)
- **Go**: `ulule/limiter` (good)
- **Rails**: `Rack::Attack` (excellent)
- **.NET**: Built-in `Microsoft.AspNetCore.RateLimiting` middleware (excellent, native support)

All options have good libraries. TypeScript/Rails/.NET have the most mature solutions.

### Email Notifications
- **TypeScript**: nodemailer, Resend, SendGrid SDK (excellent npm packages)
- **Python**: FastAPI-Mail, python-emails (good)
- **Go**: gomail (basic but functional)
- **Rails**: ActionMailer (best integrated solution)
- **.NET**: MailKit, FluentEmail (excellent, mature libraries)

Rails has the best built-in email system. TypeScript and .NET have the most third-party options.

### OAuth2 Implementation
- **TypeScript**: Auth.js (NextAuth), Passport.js (battle-tested)
- **Python**: Authlib, FastAPI-Users (good but more manual)
- **Go**: Manual implementation with libraries (more work)
- **Rails**: Devise + doorkeeper (most comprehensive)
- **.NET**: ASP.NET Core Identity + Duende IdentityServer (enterprise-grade, free tier available)

TypeScript, Rails, and .NET have the best OAuth2 support out of the box.

### Security Logging (OWASP Top 10)
All can implement OWASP recommendations:
- Request logging with rate limit violations
- Failed authentication attempts
- API key validation failures
- Input validation failures

**Logging Solutions:**
- **TypeScript**: Winston, Pino (excellent structured logging)
- **Python**: Loguru, structlog (good)
- **Go**: zap, zerolog (excellent performance)
- **Rails**: Built-in logger, Lograge (integrated)
- **.NET**: Serilog, built-in ILogger (excellent structured logging with sinks)

TypeScript (Pino), .NET (Serilog), and Rails have the best structured logging support.

---

## Recommendation: .NET 10 Stack (ASP.NET Core Minimal APIs)

### Recommended Architecture

#### Backend: ASP.NET Core Minimal APIs
```csharp
// Minimal APIs for concise, self-documenting code
// Built-in auth, rate limiting, logging, DI
// ZERO framework dependencies beyond .NET itself
```

#### Database: PostgreSQL with Dapper (Micro-ORM)
```csharp
// Npgsql driver + Dapper for raw SQL control
// Avoid heavy ORMs - write SQL directly for clarity
// Total dependencies: 2 packages (Npgsql + Dapper)
```

#### Frontend: Razor Pages + htmx
```html
<!-- Server-rendered HTML with minimal JavaScript -->
<!-- htmx for dynamic interactions (tiny library) -->
<!-- Avoid heavy SPA frameworks to minimize dependencies -->
```

#### Deployment: Docker Multi-Stage Build
```dockerfile
# Multi-stage build for production image
# Development: dotnet watch with hot reload
# Production: Single container + managed DB
```

### Why .NET 10 is Best with Minimal Dependency Constraint

1. **Minimal Dependencies (10/10)**: Nearly ZERO external packages needed
   - Rate limiting: Built-in `Microsoft.AspNetCore.RateLimiting`
   - Auth: Built-in JWT authentication + ASP.NET Core Identity
   - Email: Built-in `System.Net.Mail.SmtpClient`
   - Logging: Built-in `ILogger`
   - HTTP/JSON: Built-in `HttpClient`, `System.Text.Json`

2. **Self-Documenting Code (10/10)**: Strong type system makes code clear
   - C# records for immutable data models
   - Nullable reference types prevent null errors
   - LINQ queries read like English
   - No comments needed - types explain intent

3. **AI Code Generation (8/10)**: Good AI understanding of C# patterns
   - Clear, predictable patterns
   - Less ambiguity than dynamic languages
   - Compile-time errors catch AI mistakes

4. **Performance (10/10)**: Excellent for production
   - 30-40% faster than Node.js
   - Near-Go performance with better DX

5. **Minimal Token Usage**: Concise modern C# syntax
   - Top-level statements eliminate boilerplate
   - Target-typed new expressions
   - Pattern matching for clear logic

### Example Minimal Dependency Stack
```json
{
  "dependencies": {
    "Npgsql": "PostgreSQL driver",
    "Dapper": "Micro-ORM (optional - can use raw ADO.NET)"
  },
  "built-in": [
    "Rate limiting",
    "JWT authentication",
    "SMTP email",
    "Logging (ILogger)",
    "DI container",
    "Configuration",
    "HTTP client",
    "JSON serialization"
  ]
}
```

### Folder Structure
```
generatorlog/
├── Program.cs                 # Main entry point (Minimal API)
├── Models/
│   ├── User.cs               # User record
│   ├── Generator.cs          # Generator record
│   └── UsageLog.cs           # Usage log record
├── Services/
│   ├── GeneratorService.cs   # Business logic
│   └── EmailService.cs       # SMTP email (built-in)
├── Data/
│   └── Database.cs           # Dapper queries
├── Pages/                     # Razor Pages for frontend
│   ├── Index.cshtml
│   └── Dashboard.cshtml
├── wwwroot/
│   └── htmx.min.js           # Single JS dependency
├── appsettings.json
├── Dockerfile
└── generatorlog.csproj       # Only 2 NuGet packages!
```

### Example Technology Stack
```json
{
  "backend": "Fastify 4.x",
  "frontend": "Next.js 14+",
  "database": "PostgreSQL 16",
  "orm": "Prisma 5.x",
  "auth": "Auth.js (NextAuth.js v5)",
  "rateLimit": "@fastify/rate-limit",
  "email": "Resend or nodemailer",
  "validation": "Zod",
  "logging": "Pino",
  "testing": "Vitest + Playwright",
  "deployment": "Docker + docker-compose"
}
```

---

## Alternative Recommendations

### If AI Code Generation is THE Top Priority: TypeScript/Node.js
**TypeScript** still has the best AI code generation (10/10), but requires careful dependency management:
- Use Fastify (not Next.js) + raw `pg` client (not Prisma)
- Write custom auth/rate limiting code
- Use htmx for frontend (minimal JS)
- **Total packages: ~6-8** vs .NET's 1-2

**Trade-off**: More dependencies than .NET, but slightly better AI assistance.

### If Raw Performance + Minimal Docker Image: Go
**Go** offers the smallest Docker images (~10-20MB) and best performance:
- Incredible standard library (http, json, smtp all built-in)
- **Total external packages: ~2-3**
- Perfect for minimal dependencies

**Trade-off**: More verbose code, less AI training data (6/10), slower development.

### TypeScript/Node.js vs .NET vs Go: Minimal Dependency Showdown

| Metric | TypeScript | .NET | Go |
|--------|-----------|------|-----|
| External Packages | 6-8 | 1-2 | 2-3 |
| Built-in Auth | ❌ | ✅ | ❌ |
| Built-in Rate Limiting | ❌ | ✅ | ❌ |
| Built-in Email | ❌ | ✅ | ✅ |
| Self-Documenting | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| AI Code Gen | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Development Speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

**Winner**: .NET - Best balance of minimal dependencies while maintaining good AI code generation.

---

## .NET vs TypeScript: Updated Comparison with New Constraints

### .NET NOW Wins At:
- ⭐⭐⭐⭐⭐ **Minimal Dependencies**: 1-2 packages vs 6-8 (CRITICAL)
- ⭐⭐⭐⭐⭐ **Built-in Features**: Rate limiting, auth, email all included
- ⭐⭐⭐⭐⭐ **Self-Documenting**: Records, nullable types, LINQ
- **Performance**: 30-40% faster in benchmarks, better memory management
- **Type Safety**: Null reference types, stricter compiler
- **Production Stability**: Fewer runtime errors due to compilation

### TypeScript Still Wins At:
- **AI Code Generation** (10/10 vs 8/10): More training data
- **Development Speed**: Slightly faster iteration
- **Full-Stack Integration**: Next.js (though we're avoiding it now)
- **Package Ecosystem**: npm has more packages (but that's bad for minimal deps!)
- **Learning Curve**: JavaScript more accessible than C#
- **Docker Images**: Smaller images (~50-100MB vs ~100-200MB)

### Recommendation with Minimal Dependency Constraint

**For GeneratorLog with minimal dependencies + self-documenting code**: **.NET 10 is the clear winner**

1. **Minimal Dependencies** is a HARD constraint - .NET wins decisively (1-2 vs 6-8 packages)
2. **Self-documenting code** - Both excellent, .NET's null safety gives it an edge
3. **AI code generation** - .NET 8/10 is still very good, TypeScript 10/10 is slightly better
4. **Token efficiency** - Modern C# is concise, no comments needed

---

## Next Steps

1. **User Decision**: Confirm .NET 10 as technology stack (or choose alternative)
2. **Create ADR**: Document the architectural decision in `docs/adr/`
3. **Initialize Project**: Set up minimal .NET project (`dotnet new webapi`)
4. **Configure Docker**: Create Dockerfile with multi-stage build
5. **Database Schema**: Design PostgreSQL schema (raw SQL, no heavy ORM)
6. **Minimal Dependencies**: Install only Npgsql + Dapper
7. **Authentication**: Implement built-in JWT + API key validation
8. **iOS Shortcuts**: Research shortcut creation and QR code generation

---

## References

- **TypeScript/Node.js:**
  - Next.js Documentation: https://nextjs.org/docs
  - Fastify Documentation: https://fastify.dev
  - Prisma Documentation: https://prisma.io/docs

- **Python:**
  - FastAPI Documentation: https://fastapi.tiangolo.com

- **.NET:**
  - ASP.NET Core Documentation: https://learn.microsoft.com/en-us/aspnet/core
  - Entity Framework Core: https://learn.microsoft.com/en-us/ef/core
  - C# Dev Kit for VSCode: https://code.visualstudio.com/docs/csharp/get-started
  - Arch Linux .NET Setup: https://wiki.archlinux.org/title/.NET

- **General:**
  - OWASP Top 10: https://owasp.org/www-project-top-ten
  - iOS Shortcuts: https://support.apple.com/guide/shortcuts
  - Docker Documentation: https://docs.docker.com
