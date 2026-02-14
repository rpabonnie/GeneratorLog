# cURL Testing Examples for GeneratorLog API

This document provides command-line testing examples using cURL for the GeneratorLog API. These examples are useful for quick testing, automation, and CI/CD integration.

## Prerequisites

- **Backend server running**: `pnpm --filter generatorlog-backend dev`
- **Database seeded**: `pnpm --filter generatorlog-backend db:seed`
- **API key from seed script output** (64-character hex string)
- **jq installed** (optional, for pretty JSON): `brew install jq` or `apt install jq`

## Set Environment Variables

Before running the examples, export these variables:

```bash
export API_KEY="your-api-key-from-seed-script"
export BASE_URL="http://localhost:3000"
export GENERATOR_ID=1
```

Replace `your-api-key-from-seed-script` with the actual API key output from `pnpm db:seed`.

## Basic Endpoints

### Health Check

Check if the API server is running:

```bash
curl -X GET "$BASE_URL/health" | jq
```

**Expected Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-02-14T12:34:56.789Z",
  "environment": "development"
}
```

### Get API Info

Get basic API information:

```bash
curl -X GET "$BASE_URL/" | jq
```

**Expected Response** (200 OK):
```json
{
  "name": "GeneratorLog API",
  "version": "1.0.0",
  "status": "running"
}
```

## Generator Toggle Endpoint

### Start Generator

Start the generator (when it's not running):

```bash
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
```

**Expected Response** (200 OK):
```json
{
  "status": "started",
  "generator": {
    "id": 1,
    "name": "Test Generator - Honda EU2200i",
    "isRunning": true,
    "currentStartTime": "2026-02-14T12:34:56.789Z",
    "totalHours": 125.5
  }
}
```

### Stop Generator

Stop the generator (when it's running). **Important**: Wait at least 2 seconds after starting due to rate limiting.

```bash
sleep 2
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
```

**Expected Response** (200 OK):
```json
{
  "status": "stopped",
  "generator": {
    "id": 1,
    "name": "Test Generator - Honda EU2200i",
    "isRunning": false,
    "totalHours": 125.50055555555556,
    "durationHours": 0.0005555555555555556
  }
}
```

## Rate Limiting Test

Send two rapid requests to test the 1 request/second rate limit. The second request should return 429:

```bash
# First request (should succeed)
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq

# Second request immediately after (should fail with 429)
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
```

**Expected Response for Second Request** (429 Too Many Requests):
```json
{
  "error": "Too many requests",
  "retryAfter": 1
}
```

### One-liner Rate Limit Test

```bash
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" && \
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
```

## Authentication Tests

### Test Invalid API Key

```bash
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: invalid-api-key-12345" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "Invalid API key"
}
```

### Test Missing API Key

```bash
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
```

**Expected Response** (401 Unauthorized):
```json
{
  "error": "API key required"
}
```

### Test Invalid Generator ID

Test with a generator ID that doesn't belong to the user:

```bash
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"generatorId": 999}' | jq
```

**Expected Response** (403 Forbidden):
```json
{
  "error": "Generator not found or access denied"
}
```

## Complete Test Sequence

Run this complete sequence to test all functionality:

```bash
#!/bin/bash

# Set your API key
export API_KEY="your-api-key-from-seed-script"
export BASE_URL="http://localhost:3000"
export GENERATOR_ID=1

echo "=== 1. Health Check ==="
curl -s -X GET "$BASE_URL/health" | jq
echo ""

echo "=== 2. Start Generator ==="
curl -s -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
echo ""

echo "=== 3. Wait 2 seconds (rate limit) ==="
sleep 2

echo "=== 4. Stop Generator ==="
curl -s -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
echo ""

echo "=== 5. Test Rate Limiting (should fail) ==="
curl -s -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
echo ""

echo "=== 6. Test Invalid API Key ==="
curl -s -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: invalid-key" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
echo ""

echo "=== 7. Test Missing API Key ==="
curl -s -X POST "$BASE_URL/api/generator/toggle" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" | jq
echo ""

echo "=== All tests completed ==="
```

Save this as `test-api.sh`, make it executable with `chmod +x test-api.sh`, and run it.

## Verbose Mode

To see detailed request/response information including headers:

```bash
curl -v -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}"
```

## Headers Only

To see only response headers:

```bash
curl -I -X GET "$BASE_URL/health"
```

## Save Response to File

```bash
curl -X POST "$BASE_URL/api/generator/toggle" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"generatorId\": $GENERATOR_ID}" \
  -o response.json

cat response.json | jq
```

## Troubleshooting

### Connection Refused

**Error**: `curl: (7) Failed to connect to localhost port 3000: Connection refused`

**Solution**: Make sure the backend server is running:
```bash
pnpm --filter generatorlog-backend dev
```

### Invalid JSON Response

If you get HTML instead of JSON, the server might be in an error state. Check the server logs.

### Rate Limit Always Triggers

If every request returns 429, wait 2+ seconds between requests or restart the server to clear rate limit state.

## Additional Resources

- **Postman Collection**: Import from `docs/postman/GeneratorLog.postman_collection.json`
- **Setup Guide**: See `docs/testing/database-setup-and-testing.md`
- **API Documentation**: See main README.md
