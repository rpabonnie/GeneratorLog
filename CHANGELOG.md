# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

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
