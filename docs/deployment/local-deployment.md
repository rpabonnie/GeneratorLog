# Local Deployment Guide

This guide covers deploying GeneratorLog on a local server or self-hosted environment with a user-provided PostgreSQL database.

---

## Overview

**Architecture**:
- **Backend**: Docker container running Node.js + Fastify API
- **Database**: User-provided PostgreSQL server (self-hosted, cloud, or Docker)
- **Frontend**: Docker container running React (optional)

**Requirements**:
- Docker and Docker Compose
- PostgreSQL database server (version 14+)
- 512MB RAM minimum
- 5GB disk space minimum

---

## Prerequisites

### Required Software

1. **Docker** and **Docker Compose**
   - Linux: [Install Docker Engine](https://docs.docker.com/engine/install/)
   - macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Windows: [Docker Desktop WSL2 backend](https://docs.docker.com/desktop/windows/wsl/)

2. **PostgreSQL Database** (choose one option):
   - **Option A**: Use included Docker Compose PostgreSQL (recommended for development)
   - **Option B**: Self-hosted PostgreSQL server
   - **Option C**: Cloud PostgreSQL (Neon, Supabase, Azure, AWS RDS, etc.)

3. **Git** (optional, for cloning repository)
   ```bash
   # Debian/Ubuntu
   sudo apt-get install git

   # macOS (Homebrew)
   brew install git
   ```

---

## Option 1: Quick Start with Docker Compose (Recommended)

This method includes PostgreSQL in the Docker stack - easiest for local development and testing.

### Step 1: Clone Repository
```bash
git clone https://github.com/yourusername/GeneratorLog.git
cd GeneratorLog
```

### Step 2: Configure Environment
```bash
# Copy example environment file
cp backend/.env.example backend/.env

# Edit .env if needed (defaults work for Docker Compose setup)
nano backend/.env
```

**Default `.env` values work out of the box with Docker Compose**.

### Step 3: Start All Services
```bash
# Start database, backend, and frontend
docker compose up -d

# View logs
docker compose logs -f
```

**Services will be available at**:
- Backend API: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

### Step 4: Run Database Migrations
```bash
# Enter backend container
docker compose exec backend sh

# Run migrations
npm run db:migrate

# Exit container
exit
```

### Step 5: Verify Installation
```bash
# Test API health endpoint
curl http://localhost:3000/health

# Expected response: {"status":"ok","database":"connected"}
```

### Stop Services
```bash
# Stop all services (keeps data)
docker compose stop

# Stop and remove containers (keeps data)
docker compose down

# Stop and remove everything including data volumes
docker compose down -v
```

---

## Option 2: Docker Container with External PostgreSQL

Use this method if you have an existing PostgreSQL server (self-hosted or cloud).

### Step 1: Prepare PostgreSQL Database

#### Create Database and User
```sql
-- Connect to PostgreSQL as admin
psql -U postgres

-- Create database
CREATE DATABASE generatorlog;

-- Create user with password
CREATE USER generatorlog WITH ENCRYPTED PASSWORD 'your-secure-password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE generatorlog TO generatorlog;

-- Exit psql
\q
```

#### Test Connection
```bash
psql -U generatorlog -d generatorlog -h localhost -W
# Enter password when prompted
```

### Step 2: Configure Environment

Create `.env` file in backend directory:
```bash
# backend/.env

# Database Configuration
DATABASE_URL=postgresql://generatorlog:your-secure-password@your-db-host:5432/generatorlog?sslmode=prefer

# Or use individual components
DB_HOST=your-db-host        # e.g., localhost, 192.168.1.100, db.example.com
DB_PORT=5432
DB_NAME=generatorlog
DB_USER=generatorlog
DB_PASSWORD=your-secure-password
DB_SSL=false                # Set to true for cloud databases

# Application Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_RATE_LIMIT=1

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-random-secret-key-here

# Email Configuration (optional, for maintenance reminders)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=GeneratorLog <noreply@generatorlog.com>

# OAuth2 Configuration (optional, for web interface)
# OAUTH_CLIENT_ID=your-oauth-client-id
# OAUTH_CLIENT_SECRET=your-oauth-client-secret
# OAUTH_REDIRECT_URI=http://your-server:3000/auth/callback

# Logging
LOG_LEVEL=info
```

### Step 3: Build Docker Image
```bash
cd GeneratorLog/backend

# Build the image
docker build -t generatorlog:latest .
```

### Step 4: Run Container
```bash
docker run -d \
  --name generatorlog \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  generatorlog:latest
```

**Or with inline environment variables**:
```bash
docker run -d \
  --name generatorlog \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/generatorlog?sslmode=require" \
  -e NODE_ENV="production" \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e API_RATE_LIMIT="1" \
  generatorlog:latest
```

### Step 5: Run Database Migrations
```bash
# Execute migration command in running container
docker exec generatorlog npm run db:migrate
```

### Step 6: Verify Installation
```bash
# Check container logs
docker logs generatorlog

# Test API
curl http://localhost:3000/health
```

---

## Option 3: Standalone Installation (No Docker)

For running directly on the host system without Docker.

### Step 1: Install Node.js 26.1.1

#### Using nvm (Recommended)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 26.1.1
nvm install 26.1.1
nvm use 26.1.1
nvm alias default 26.1.1
```

#### Using Package Manager
```bash
# Debian/Ubuntu (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_25.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (Homebrew)
brew install node@25
```

### Step 2: Install Dependencies
```bash
cd GeneratorLog/backend
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
nano .env
# Edit DATABASE_URL and other settings
```

### Step 4: Build Application
```bash
npm run build
```

### Step 5: Run Database Migrations
```bash
npm run db:migrate
```

### Step 6: Start Application
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Step 7: Run as System Service (Linux)

Create systemd service file:
```bash
sudo nano /etc/systemd/system/generatorlog.service
```

Service configuration:
```ini
[Unit]
Description=GeneratorLog API Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/GeneratorLog/backend
Environment="NODE_ENV=production"
EnvironmentFile=/opt/GeneratorLog/backend/.env
ExecStart=/usr/bin/node /opt/GeneratorLog/backend/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable generatorlog
sudo systemctl start generatorlog
sudo systemctl status generatorlog
```

---

## Database Setup Details

### PostgreSQL Installation (if needed)

#### Debian/Ubuntu
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS
```bash
brew install postgresql@16
brew services start postgresql@16
```

#### Docker (Standalone PostgreSQL)
```bash
docker run -d \
  --name postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=generatorlog \
  -e POSTGRES_USER=generatorlog \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Database Migrations

Migrations use Drizzle Kit. Run migrations whenever you update the schema.

```bash
# Generate migration
npm run db:generate

# Push schema to database
npm run db:push

# Or run custom migration
npm run db:migrate
```

### Database Backup

#### Manual Backup
```bash
# Backup database
pg_dump -U generatorlog -h localhost generatorlog > backup-$(date +%Y%m%d).sql

# Restore backup
psql -U generatorlog -h localhost -d generatorlog < backup-20260211.sql
```

#### Automated Backup (cron)
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * pg_dump -U generatorlog -h localhost generatorlog | gzip > /backups/generatorlog-$(date +\%Y\%m\%d).sql.gz
```

---

## Reverse Proxy Setup (Production)

### Nginx Reverse Proxy

Install Nginx:
```bash
sudo apt-get install nginx
```

Create site configuration:
```bash
sudo nano /etc/nginx/sites-available/generatorlog
```

Configuration:
```nginx
server {
    listen 80;
    server_name generatorlog.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/generatorlog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Add HTTPS with Let's Encrypt
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d generatorlog.example.com

# Auto-renewal is configured automatically
```

---

## Firewall Configuration

### UFW (Ubuntu/Debian)
```bash
# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (only if accessed remotely)
# sudo ufw allow 5432/tcp

# Enable firewall
sudo ufw enable
```

### firewalld (CentOS/RHEL)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## Monitoring and Logs

### View Application Logs

#### Docker Container
```bash
# Follow logs
docker logs -f generatorlog

# Last 100 lines
docker logs --tail 100 generatorlog
```

#### Standalone Installation
```bash
# systemd service logs
sudo journalctl -u generatorlog -f

# Application log file (if configured)
tail -f /var/log/generatorlog/app.log
```

### Health Monitoring

Setup simple health check script:
```bash
#!/bin/bash
# /usr/local/bin/health-check.sh

ENDPOINT="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)

if [ $RESPONSE -eq 200 ]; then
    echo "OK: GeneratorLog is healthy"
    exit 0
else
    echo "ERROR: GeneratorLog health check failed (HTTP $RESPONSE)"
    # Restart service
    systemctl restart generatorlog
    exit 1
fi
```

Add to cron:
```bash
# Check every 5 minutes
*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/generatorlog/health.log 2>&1
```

---

## Updating the Application

### Docker Container
```bash
# Pull latest code
git pull origin main

# Rebuild image
docker build -t generatorlog:latest ./backend

# Stop old container
docker stop generatorlog
docker rm generatorlog

# Start new container
docker run -d \
  --name generatorlog \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file backend/.env \
  generatorlog:latest

# Run migrations
docker exec generatorlog npm run db:migrate
```

### Standalone Installation
```bash
# Pull latest code
git pull origin main

# Install dependencies
cd backend
npm install

# Build application
npm run build

# Run migrations
npm run db:migrate

# Restart service
sudo systemctl restart generatorlog
```

---

## Troubleshooting

### Common Issues

#### Cannot connect to database
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U generatorlog -h localhost -d generatorlog

# Check firewall rules
sudo ufw status

# Verify DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL
```

#### Port 3000 already in use
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
kill -9 <PID>

# Or change PORT in .env
```

#### Permission errors in Docker
```bash
# Fix file permissions
sudo chown -R $(whoami):$(whoami) GeneratorLog/

# Fix Docker socket permissions
sudo usermod -aG docker $USER
# Log out and back in
```

#### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Security Checklist

- ✅ Change default PostgreSQL password
- ✅ Generate strong SESSION_SECRET (`openssl rand -base64 32`)
- ✅ Use SSL/TLS for database connections (set `DB_SSL=true`)
- ✅ Configure firewall (only expose necessary ports)
- ✅ Use HTTPS with Let's Encrypt (production)
- ✅ Keep system and dependencies updated
- ✅ Restrict PostgreSQL to localhost (if possible)
- ✅ Set up automated backups
- ✅ Never commit `.env` file to git
- ✅ Use strong API keys (document generation later)
- ✅ Monitor logs for suspicious activity

---

## Performance Tuning

### PostgreSQL Tuning
```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/16/main/postgresql.conf

# Increase shared_buffers for better performance
shared_buffers = 256MB

# Increase work_mem for complex queries
work_mem = 4MB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Node.js Tuning
```bash
# Increase Node.js memory limit if needed
node --max-old-space-size=2048 dist/index.js
```

---

## Next Steps

1. Configure email (SMTP) settings for maintenance reminders
2. Set up OAuth2 for web interface authentication
3. Configure custom domain and SSL
4. Set up monitoring and alerting
5. Implement log rotation
6. Configure automated backups

---

## References

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [ADR 0002: Database Choice](../adr/0002-postgresql-database-choice.md)
- [Cloud Deployment Guide](./cloud-deployment.md)
