# GeneratorLog

A web service for tracking home power generator usage with automated maintenance reminders.

## Technology Stack

- **Backend**: TypeScript + Fastify + PostgreSQL
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL 16
- **Deployment**: Docker + docker-compose

See [ADR 0001](docs/adr/0001-typescript-nodejs-react-stack.md) for technology stack decision details.

## Features

- API endpoint for starting/stopping generator tracking (API key authenticated)
- iOS Shortcuts integration for quick access
- Web dashboard for configuration and usage tracking
- Multi-user support
- Automated email maintenance reminders
- Rate limiting (1 req/sec)
- OWASP Top 10 security compliance

## Prerequisites

- Node.js 24+ (use fnm: `fnm use 24`)
- Docker and docker-compose
- PostgreSQL 16 (if running locally without Docker)

## Getting Started

### Using Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rpabonnie/GeneratorLog.git
   cd GeneratorLog
   ```

2. **Start all services**:
   ```bash
   docker-compose up
   ```

3. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

### Local Development

#### Backend

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

#### Frontend

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   npm run preview
   ```

## Project Structure

```
GeneratorLog/
├── backend/                # Fastify TypeScript backend
│   ├── src/
│   │   ├── index.ts       # Main entry point
│   │   └── config.ts      # Configuration
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # React TypeScript frontend
│   ├── src/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
│   ├── adr/              # Architecture Decision Records
│   └── 00001-technology-stack-research.md
├── docker-compose.yml
└── README.md
```

## Development Guidelines

### Minimal Dependencies Philosophy

This project follows a **minimal dependencies** approach:

- Only add libraries when writing the code would take significant effort
- Prefer built-in features over third-party packages
- Generate custom code for simple tasks (rate limiting, validation)
- Current backend dependencies: `fastify`, `pg`, `dotenv` (core only)

### Code Quality Standards

- **Self-documenting code**: Strong typing, descriptive names, clear structure
- **Minimal comments**: Code should be obvious
- **Type safety first**: Strict TypeScript mode enabled
- **KISS principle**: Simple solutions over clever abstractions

See [CLAUDE.md](CLAUDE.md) for detailed coding guidelines.

## Database

### PostgreSQL Setup

The project uses PostgreSQL 16. With Docker, the database is automatically set up.

For local development without Docker:

```bash
# Create database
createdb generatorlog

# Set environment variables in backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=generatorlog
DB_USER=postgres
DB_PASSWORD=postgres
```

## API Documentation

### Health Check

```bash
GET /health
```

Returns server status and timestamp.

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-08T21:22:00.000Z"
}
```

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`:

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment (development/production)
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

### Frontend

- `VITE_API_URL`: Backend API URL (default: http://localhost:3000)

## Docker Commands

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild containers
docker-compose up --build

# View logs
docker-compose logs -f

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

## License

MIT - see [LICENSE](LICENSE) file for details

## Author

Ray Pabonnie

## Next Steps

- [ ] Implement database schema and migrations
- [ ] Add API key authentication
- [ ] Implement rate limiting
- [ ] Create generator toggle endpoint
- [ ] Build dashboard UI
- [ ] Add email notification service
- [ ] iOS Shortcuts integration
- [ ] OAuth2 for web interface
