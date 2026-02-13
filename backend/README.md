# GeneratorLog Backend

TypeScript backend API for GeneratorLog using Fastify and Drizzle ORM.

## Features

- **Database**: PostgreSQL with Drizzle ORM
- **Rate Limiting**: 1 request per second (configurable)
- **API Key Authentication**: Secure endpoint access
- **Generator Tracking**: Start/stop generator with automatic hour tracking
- **Maintenance Calculations**: Hours and months since last oil change
- **Type Safety**: Full TypeScript with Zod validation

## Development

### Prerequisites

- Node.js 24+
- PostgreSQL 16+
- pnpm (or npm)

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate database migration
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test <filename>
```

All tests follow TDD principles and use Vitest.

## Database

### Schema

- **users**: User accounts (email, OAuth info)
- **generators**: Generator records (name, hours, running state)
- **usage_logs**: Historical usage tracking (start, end, duration)
- **api_keys**: API authentication keys

### Migrations

```bash
# Generate a new migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly to database (dev only)
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

## API Endpoints

### POST /api/generator/toggle

Toggle generator on/off state.

**Headers:**
- `x-api-key`: Your API key (required)

**Body:**
```json
{
  "generatorId": 1
}
```

**Response (Start):**
```json
{
  "status": "started",
  "isRunning": true,
  "startTime": "2026-02-13T16:00:00.000Z",
  "totalHours": 125.5
}
```

**Response (Stop):**
```json
{
  "status": "stopped",
  "isRunning": false,
  "durationHours": 2.5,
  "totalHours": 128.0
}
```

**Rate Limit:** 1 request per second
- Status: `429 Too Many Requests` if exceeded

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T16:00:00.000Z",
  "environment": "development"
}
```

### GET /

API information.

**Response:**
```json
{
  "name": "GeneratorLog API",
  "version": "1.0.0",
  "status": "running"
}
```

## Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Random secret for sessions

**Optional:**
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `API_RATE_LIMIT`: Requests per second (default: 1)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Log level (info/debug/error)

## Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── index.ts        # Database connection
│   │   └── schema.ts       # Drizzle schema
│   ├── middleware/
│   │   └── rate-limiter.ts # Rate limiting
│   ├── routes/
│   │   └── generator.ts    # Generator endpoints
│   ├── services/
│   │   ├── generator.ts    # Generator business logic
│   │   └── maintenance.ts  # Maintenance calculations
│   ├── config.ts           # Configuration
│   └── index.ts            # Main entry point
├── tests/
│   ├── config.test.ts
│   ├── generator-toggle.test.ts
│   ├── maintenance.test.ts
│   └── rate-limiter.test.ts
├── drizzle/                # Database migrations
└── scripts/
    └── migrate.ts          # Migration runner
```

## Architecture

This backend follows a minimal dependencies philosophy:

- **Fastify**: Lightweight, fast web framework
- **Drizzle ORM**: Type-safe, lightweight ORM
- **Zod**: Runtime validation
- **pg**: PostgreSQL driver
- **Custom code**: Rate limiting, auth helpers

No heavy frameworks or unnecessary abstractions. Code is self-documenting with strong typing.

## License

MIT
