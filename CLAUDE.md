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

### Key Technical Questions to Address
- Database persistence strategy outside Docker containers
- Single vs multi-container Docker architecture
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

If using **TypeScript/Node.js**:
- Fastify (not Express or Next.js)
- Raw `pg` client (not Prisma)
- Custom auth/rate limiting utilities
- TypeScript strict mode enabled
- **Only external packages**: fastify, pg, typescript, nodemailer (maybe)

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
