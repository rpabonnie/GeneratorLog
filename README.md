# GeneratorLog

A web service for tracking home power generator usage with automated maintenance reminders.

**Open Source** | **Self-Hostable** | **Cloud-Ready**

---

## 🚀 Quick Start

Choose your deployment method:

- **☁️ Cloud (Azure)**: [Cloud Deployment Guide](docs/deployment/cloud-deployment.md) - Free beta ($0/month), Production ($9-30/month)
- **🏠 Local Server**: [Local Deployment Guide](docs/deployment/local-deployment.md) - Self-hosted with Docker
- **💻 Development**: See "Getting Started" section below

---

## Technology Stack

- **Backend**: TypeScript + Node.js 26.1.1 + Fastify
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL 16 (cloud or self-hosted)
- **ORM**: Drizzle ORM + Zod validation
- **Deployment**: Docker containers

**Architecture Decisions**:
- [ADR 0001](docs/adr/0001-typescript-nodejs-react-stack.md) - Technology Stack
- [ADR 0002](docs/adr/0002-postgresql-database-choice.md) - PostgreSQL Database Choice

---

## Features

- ✅ API endpoint for starting/stopping generator tracking (API key authenticated)
- ✅ iOS Shortcuts integration for quick access via iPhone
- ✅ Web dashboard for configuration and usage tracking
- ✅ Multi-user support (multiple users, each with their own generator)
- ✅ Automated email maintenance reminders
- ✅ Rate limiting (1 req/sec)
- ✅ OWASP Top 10 security compliance
- ✅ Cloud deployment (Azure) or self-hosted options

---

## 🌐 Deployment Options

### Cloud Deployment (Azure)

**Beta Testing** (FREE):
- Azure App Service F1 (Free tier)
- Neon PostgreSQL (Free tier)
- **Cost**: $0/month
- [Full Cloud Deployment Guide →](docs/deployment/cloud-deployment.md)

**Production**:
- Azure App Service B1 or Container Instances
- PostgreSQL (Neon Free or Azure managed)
- **Cost**: $9-30/month
- [Full Cloud Deployment Guide →](docs/deployment/cloud-deployment.md)

### Local Server Deployment

Run on your own hardware with Docker:
- Single Docker container (backend)
- User-provided PostgreSQL database
- Nginx reverse proxy for HTTPS
- [Full Local Deployment Guide →](docs/deployment/local-deployment.md)

---

## Prerequisites

### For Development
- **Node.js 26.1.1** (use nvm: `nvm install 26.1.1`)
- **Docker** and **docker-compose**
- **Git**

### For Cloud Deployment
- **Azure account** (free tier available)
- **Azure CLI** (for deployment)
- Optional: **Neon account** (free PostgreSQL)

### For Local Deployment
- **Docker** and **docker-compose**
- **PostgreSQL 16+** (or use included Docker PostgreSQL)

---

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

## Testing & TDD

- Follow a TDD loop: write a failing test, implement the smallest change, then refactor with tests green.
- Backend unit tests (Vitest): `pnpm --filter generatorlog-backend test` (watch mode: `pnpm --filter generatorlog-backend test:watch`)
- Frontend end-to-end tests (Playwright): `pnpm --filter frontend test:e2e` (UI mode: `pnpm --filter frontend test:e2e:ui`)
- Install Playwright browsers once per machine: `pnpm --filter frontend exec playwright install chromium`

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
- **TDD by default**: write or update tests first, keep the suite green
- **KISS principle**: Simple solutions over clever abstractions

See [CLAUDE.md](CLAUDE.md) for detailed coding guidelines.

## Database

### PostgreSQL Configuration

GeneratorLog uses **PostgreSQL 16** as its database. See [ADR 0002](docs/adr/0002-postgresql-database-choice.md) for why PostgreSQL was chosen over SQLite.

#### Docker (Automatic Setup)

With Docker Compose, PostgreSQL is automatically configured:
```bash
docker compose up
```

#### Manual PostgreSQL Setup

For local development without Docker:

```bash
# Create database
createdb generatorlog

# Create user
psql postgres -c "CREATE USER generatorlog WITH ENCRYPTED PASSWORD 'password';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE generatorlog TO generatorlog;"
```

Update `backend/.env`:
```bash
DATABASE_URL=postgresql://generatorlog:password@localhost:5432/generatorlog
```

#### Cloud PostgreSQL

For production, use a managed PostgreSQL service:
- **Neon** (free tier): [console.neon.tech](https://console.neon.tech)
- **Azure Database for PostgreSQL**: See [Cloud Deployment Guide](docs/deployment/cloud-deployment.md)
- **AWS RDS**, **Google Cloud SQL**, **Supabase**, etc.

---

## API Documentation

### Generator Toggle

```bash
POST /api/generator/toggle
```

Start or stop generator tracking. Requires API key authentication and respects rate limiting (1 req/sec).

**Headers:**
- `x-api-key`: Your API key (required)

**Request Body:**
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

**Error Responses:**
- `401`: Missing or invalid API key
- `400`: Invalid request body
- `404`: Generator not found
- `429`: Rate limit exceeded (retry after X seconds)

### Health Check

```bash
GET /health
```

Returns server status and timestamp.

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-08T21:22:00.000Z",
  "environment": "development"
}
```

For detailed API documentation, see [backend/README.md](backend/README.md).

## Environment Variables

### Backend Configuration

Create `backend/.env` from `backend/.env.example`:

**Required**:
- `DATABASE_URL`: PostgreSQL connection string (recommended)
  - Format: `postgresql://user:password@host:5432/dbname?sslmode=prefer`
- `NODE_ENV`: Environment (`development` or `production`)
- `SESSION_SECRET`: Random secret for sessions (generate with `openssl rand -base64 32`)
- `API_RATE_LIMIT`: API rate limit in requests per second (default: `1`)

**Optional**:
- `PORT`: Server port (default: `3000`)
- `HOST`: Server host (default: `0.0.0.0`)
- `LOG_LEVEL`: Logging level (`info`, `debug`, `error`)

**Individual Database Components** (alternative to DATABASE_URL):
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: `5432`)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_SSL`: Enable SSL (`true` or `false`)

**Email Configuration** (for maintenance reminders):
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password
- `SMTP_FROM`: From address for emails

**OAuth2 Configuration** (for web UI authentication):
- `OAUTH_CLIENT_ID`: OAuth provider client ID
- `OAUTH_CLIENT_SECRET`: OAuth provider client secret
- `OAUTH_REDIRECT_URI`: OAuth callback URL

### Frontend Configuration

- `VITE_API_URL`: Backend API URL (default: `http://localhost:3000`)

See `backend/.env.example` for full configuration template.

---

## Docker Commands

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Stop all services
docker compose down

# Rebuild containers
docker compose up --build

# View logs
docker compose logs -f

# Remove volumes (WARNING: deletes data)
docker compose down -v
```

---

## Contributing

This is an open source project. **Contributions are welcome!**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CLAUDE.md](CLAUDE.md) for coding guidelines and philosophy.

---

## License

MIT - see [LICENSE](LICENSE) file for details

---

## Author

Ray Pabonnie

---

## Documentation

### Deployment Guides
- [☁️ Cloud Deployment (Azure)](docs/deployment/cloud-deployment.md)
- [🏠 Local Server Deployment](docs/deployment/local-deployment.md)

### Architecture Decision Records
- [ADR 0001: Technology Stack](docs/adr/0001-typescript-nodejs-react-stack.md)
- [ADR 0002: PostgreSQL Database Choice](docs/adr/0002-postgresql-database-choice.md)

### Research Documents
- [Technology Stack Research](docs/00001-technology-stack-research.md)
- [Embedded Database Research](docs/00002-embedded-database-research.md)
- [Azure Cloud Deployment Research](docs/00003-azure-cloud-deployment-research.md)

---

## Development Roadmap

### ✅ Completed
- [x] Technology stack selection (TypeScript + Fastify + PostgreSQL)
- [x] Docker containerization
- [x] Database architecture decision
- [x] Environment configuration
- [x] Cloud and local deployment guides
- [x] Database schema and migrations (Drizzle ORM)
- [x] API key authentication
- [x] Rate limiting middleware (1 req/sec)
- [x] Generator toggle endpoint
- [x] Maintenance calculations (hours/months since oil change)
- [x] Comprehensive test suite (25 tests, TDD approach)

### 🚧 In Progress
- [ ] Web dashboard UI
- [ ] Email notification service

### 📋 Planned
- [ ] iOS Shortcuts integration
- [ ] OAuth2 for web interface
- [ ] User management endpoints
- [ ] Generator usage analytics
- [ ] Maintenance reminder scheduling
