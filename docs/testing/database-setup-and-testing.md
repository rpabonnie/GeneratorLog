# Database Setup and API Testing Guide

This guide walks you through setting up the GeneratorLog database, seeding test data, and testing the API with Postman or cURL.

## Overview

The testing workflow allows you to verify the GeneratorLog API functionality without building the frontend or OAuth2 authentication. You'll:
1. Set up a PostgreSQL database
2. Run database migrations to create the schema
3. Seed test data (user, generator, API key)
4. Test the API using Postman or cURL

## Prerequisites

### Required

- **Node.js 26.1.1**: Install with nvm
  ```bash
  nvm install 26.1.1
  nvm use 26.1.1
  ```
- **pnpm**: Package manager
  ```bash
  npm install -g pnpm
  ```
- **PostgreSQL 16+**: Running locally or via Docker

### Optional

- **Postman**: For GUI-based API testing ([download](https://www.postman.com/downloads/))
- **jq**: For pretty-printing JSON in terminal
  ```bash
  # macOS
  brew install jq

  # Ubuntu/Debian
  apt install jq
  ```

## Step 1: Database Setup

Choose one of these options:

### Option A: Using Docker Compose (Recommended)

This automatically sets up PostgreSQL with the correct configuration:

```bash
cd /path/to/GeneratorLog
docker compose up -d postgres
```

The database will be available at:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `generatorlog`
- **User**: `generatorlog`
- **Password**: `password`

Check if it's running:
```bash
docker compose ps
```

### Option B: Manual PostgreSQL Setup

If you have PostgreSQL installed locally:

```bash
# Create database
createdb generatorlog

# Create user
psql postgres -c "CREATE USER generatorlog WITH ENCRYPTED PASSWORD 'password';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE generatorlog TO generatorlog;"
```

Verify the database exists:
```bash
psql -l | grep generatorlog
```

## Step 2: Install Dependencies

Install all backend dependencies:

```bash
cd backend
pnpm install
```

## Step 3: Configure Environment

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create `.env` file (if it doesn't exist):
   ```bash
   cp .env.example .env  # If you have an example file
   # OR
   touch .env
   ```

3. Add database configuration to `.env`:
   ```bash
   # For Docker Compose or local PostgreSQL with default settings
   DATABASE_URL=postgresql://generatorlog:password@localhost:5432/generatorlog

   # Other optional settings
   NODE_ENV=development
   PORT=3000
   API_RATE_LIMIT=1
   ```

4. Verify the configuration:
   ```bash
   cat .env
   ```

## Step 4: Run Migrations

Create the database schema (users, generators, apiKeys, usageLogs tables):

```bash
pnpm db:migrate
```

**Expected Output**:
```
Running database migrations...
Migrations completed successfully!
```

**If you see errors**:
- **Connection refused**: Make sure PostgreSQL is running (`docker compose ps` or `pg_isready`)
- **Database does not exist**: Create the database (see Step 1)
- **Authentication failed**: Check DATABASE_URL credentials in `.env`

## Step 5: Seed Test Data

Generate test data including a user, generator, and API key:

```bash
pnpm db:seed
```

**Expected Output**:
```
🌱 Seeding database...

Cleaned up existing test data.

✅ Database seeded successfully!

Test User Created:
  Email: test@example.com
  ID: 1

Generator Created:
  ID: 1
  Name: Test Generator - Honda EU2200i
  Total Hours: 125.5
  Last Oil Change: 75 hours
  Hours Since Oil Change: 50.5
  Is Running: false

API Key Generated:
  Key: a1b2c3d4e5f6789012345678901234567890123456789012345678901234
  Name: Test API Key - Postman

📋 Copy this API key for Postman testing:
  a1b2c3d4e5f6789012345678901234567890123456789012345678901234

Historical Usage Logs Created: 5 entries

Next steps:
  1. Start the server: pnpm --filter generatorlog-backend dev
  2. Import the Postman collection from docs/postman/
  3. Update the apiKey variable in Postman with the key above
  4. Test the toggle endpoint!
```

**IMPORTANT**: Copy the API key (64-character hex string) from the output. You'll need it for testing!

**Note**: The seed script is idempotent. You can run it multiple times - it will clean up existing test data before creating fresh data.

## Step 6: Verify Database Records

Open a new terminal and verify the seeded data:

```bash
# Connect to database
psql postgresql://generatorlog:password@localhost:5432/generatorlog

# Check users
SELECT * FROM users;

# Check generators
SELECT id, name, total_hours, is_running FROM generators;

# Check API keys (showing only first 16 characters for security)
SELECT id, name, LEFT(key, 16) || '...' as key_preview FROM api_keys;

# Check usage logs
SELECT id, generator_id, duration_hours, start_time FROM usage_logs ORDER BY start_time;

# Exit
\q
```

**Expected Results**:
- 1 user with email `test@example.com`
- 1 generator named "Test Generator - Honda EU2200i" with 125.5 total hours
- 1 API key
- 5 usage log entries

## Step 7: Start the Backend Server

Start the development server:

```bash
pnpm dev
```

**Expected Output**:
```
Server started successfully
Environment: development
Listening on 0.0.0.0:3000
Rate limit: 1 requests per second
```

**Leave this terminal running.** The server is now ready to accept requests.

## Step 8: Test with Postman

### Setup Postman Collection

1. **Open Postman**

2. **Import the collection**:
   - Click "Import" button (top left)
   - Select file: `/path/to/GeneratorLog/docs/postman/GeneratorLog.postman_collection.json`
   - Click "Import"

3. **Configure collection variables**:
   - Click on "GeneratorLog API" collection in the sidebar
   - Go to "Variables" tab
   - Update `apiKey` variable value with the API key from Step 5
   - Verify `baseUrl` is `http://localhost:3000`
   - Verify `generatorId` is `1`
   - Click "Save"

### Test Sequence

#### 1. Health Check

- Select "Health Check" request
- Click "Send"
- **Expected**: Status 200, body: `{"status": "ok", ...}`

#### 2. Get API Info

- Select "Get API Info" request
- Click "Send"
- **Expected**: Status 200, body: `{"name": "GeneratorLog API", "version": "1.0.0", ...}`

#### 3. Start Generator

- Select "Start Generator" request
- Click "Send"
- **Expected**:
  - Status 200
  - Body shows `"status": "started"` and `"isRunning": true`
  - Note the `currentStartTime`

#### 4. Wait 2 Seconds

**Important**: Due to rate limiting (1 request per second), wait at least 2 seconds before the next request.

#### 5. Stop Generator

- Select "Stop Generator" request
- Click "Send"
- **Expected**:
  - Status 200
  - Body shows `"status": "stopped"` and `"isRunning": false`
  - `durationHours` will be a small positive number (e.g., 0.0006)

#### 6. Test Rate Limiting

- Select "Test Rate Limiting" request
- Click "Send" twice rapidly (or use Collection Runner with 2 iterations, 0ms delay)
- **Expected**:
  - First request: Status 200
  - Second request: Status 429, body: `{"error": "Too many requests", "retryAfter": 1}`

#### 7. Test Invalid API Key

- Select "Invalid API Key (should fail)" request
- Click "Send"
- **Expected**: Status 401, body: `{"error": "Invalid API key"}`

#### 8. Test Missing API Key

- Select "Missing API Key (should fail)" request
- Click "Send"
- **Expected**: Status 401, body: `{"error": "API key required"}`

#### 9. Test Invalid Generator ID

- Select "Invalid Generator ID (should fail)" request
- Click "Send"
- **Expected**: Status 403, body: `{"error": "Generator not found or access denied"}`

### Success Criteria

✅ All requests return expected status codes and response bodies
✅ Rate limiting triggers on rapid requests
✅ Authentication properly rejects invalid/missing API keys
✅ Generator state toggles correctly (start → stop)

## Step 9: Test with cURL (Alternative)

If you prefer command-line testing, see detailed examples in [curl-examples.md](./curl-examples.md).

**Quick Test**:

```bash
# Set your API key
export API_KEY="your-api-key-from-seed-script"

# Health check
curl http://localhost:3000/health | jq

# Start generator
curl -X POST http://localhost:3000/api/generator/toggle \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"generatorId": 1}' | jq

# Wait 2 seconds
sleep 2

# Stop generator
curl -X POST http://localhost:3000/api/generator/toggle \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"generatorId": 1}' | jq
```

## Troubleshooting

### Database Connection Issues

**Error**: "connection refused" or "database does not exist"

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   # For Docker
   docker compose ps

   # For local PostgreSQL
   pg_isready
   ```

2. Check DATABASE_URL in `.env` matches your setup

3. Ensure database was created:
   ```bash
   psql -l | grep generatorlog
   ```

4. Test database connection:
   ```bash
   psql postgresql://generatorlog:password@localhost:5432/generatorlog -c "SELECT 1;"
   ```

### Migration Issues

**Error**: "relation already exists"

**Solution**: Drop and recreate database:
```bash
psql postgres -c "DROP DATABASE generatorlog;"
createdb generatorlog
pnpm db:migrate
```

**Error**: "permission denied"

**Solution**: Grant privileges to user:
```bash
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE generatorlog TO generatorlog;"
```

### Seed Script Issues

**Error**: "duplicate key value violates unique constraint"

**Solution**: The seed script should clean up automatically. If it fails, manually delete test data:
```bash
psql postgresql://generatorlog:password@localhost:5432/generatorlog << EOF
DELETE FROM usage_logs WHERE generator_id IN (
  SELECT id FROM generators WHERE user_id = (
    SELECT id FROM users WHERE email = 'test@example.com'
  )
);
DELETE FROM api_keys WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
DELETE FROM generators WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
DELETE FROM users WHERE email = 'test@example.com';
EOF
```

Then run `pnpm db:seed` again.

### Server Won't Start

**Error**: "port 3000 is already in use"

**Solutions**:
1. Kill the process using port 3000:
   ```bash
   # Find the process
   lsof -i :3000

   # Kill it (replace PID with actual process ID)
   kill -9 PID
   ```

2. Or change the port in `.env`:
   ```bash
   PORT=3001
   ```

### Rate Limiting Issues

**Issue**: Can't reproduce rate limiting

**Solution**:
- Ensure you're sending requests < 1 second apart
- Use Postman Collection Runner with 0ms delay
- Try the cURL rapid-fire example:
  ```bash
  curl -X POST http://localhost:3000/api/generator/toggle \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"generatorId": 1}' && \
  curl -X POST http://localhost:3000/api/generator/toggle \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"generatorId": 1}' | jq
  ```

### API Returns 403 Instead of Expected Response

**Cause**: Generator ID mismatch or API key doesn't match user

**Solution**:
- Verify generator ID is `1` (from seed data)
- Verify you copied the API key correctly (all 64 characters)
- Re-run `pnpm db:seed` to get a fresh API key

### Postman Shows HTML Instead of JSON

**Cause**: Server might be in error state or wrong URL

**Solutions**:
1. Check server logs for errors
2. Verify `baseUrl` variable in Postman is `http://localhost:3000` (no trailing slash)
3. Restart the server

## Re-seeding Database

To get fresh test data with a new API key:

```bash
pnpm db:seed
```

The script will:
1. Delete existing test user data
2. Create fresh test data
3. Generate a new API key

**Remember**: Update the `apiKey` variable in Postman with the new key!

## Next Steps

After successful testing:

1. **Explore the codebase**:
   - Review API implementation in `src/routes/generator.ts`
   - Check database schema in `src/db/schema.ts`
   - Understand maintenance calculations in `src/services/maintenance.ts`

2. **Run unit tests**:
   ```bash
   pnpm test         # Run once
   pnpm test:watch   # Watch mode
   ```

3. **Try database studio** (interactive GUI):
   ```bash
   pnpm db:studio
   ```

4. **Plan next features**:
   - OAuth2 implementation for web dashboard
   - Email notification service
   - Frontend development
   - iOS Shortcuts integration

## Reference

- **Main README**: [../../README.md](../../README.md)
- **Backend README**: [../../backend/README.md](../../backend/README.md)
- **cURL Examples**: [curl-examples.md](./curl-examples.md)
- **Database Schema**: [../../backend/src/db/schema.ts](../../backend/src/db/schema.ts)
- **API Routes**: [../../backend/src/routes/generator.ts](../../backend/src/routes/generator.ts)

## Testing Checklist

Use this checklist to verify everything works:

### Database Setup
- [ ] PostgreSQL is running
- [ ] Database `generatorlog` exists
- [ ] Migrations completed successfully
- [ ] Seed script ran successfully
- [ ] API key copied and saved

### Server
- [ ] Backend server starts without errors
- [ ] Server listening on port 3000
- [ ] No error messages in console

### API Functionality
- [ ] Health check returns 200
- [ ] Start generator returns 200 with `isRunning: true`
- [ ] Stop generator returns 200 with `durationHours`
- [ ] Rate limiting returns 429 on rapid requests
- [ ] Invalid API key returns 401
- [ ] Missing API key returns 401
- [ ] Invalid generator ID returns 403

### Database Verification
- [ ] Can connect to database with psql
- [ ] User exists in `users` table
- [ ] Generator exists in `generators` table
- [ ] API key exists in `api_keys` table
- [ ] 5 usage logs exist in `usage_logs` table

## Cleanup

To stop and clean up:

```bash
# Stop the backend server
# Press Ctrl+C in the terminal running `pnpm dev`

# Stop PostgreSQL (if using Docker)
docker compose down

# Remove test data (optional)
pnpm db:seed  # Re-run to reset, or manually delete via psql
```

---

You're now ready to test the GeneratorLog API! If you encounter any issues not covered here, check the server logs for detailed error messages.
