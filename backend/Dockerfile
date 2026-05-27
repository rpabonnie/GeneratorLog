# Backend Dockerfile (build context: repo root)
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter generatorlog-backend

COPY backend/ ./backend/
RUN pnpm --filter generatorlog-backend run build

# Install production-only flat node_modules in an isolated dir (avoids workspace hoisting to repo root)
RUN rm -rf /tmp/prod && mkdir /tmp/prod && \
    cp backend/package.json /tmp/prod/ && \
    cd /tmp/prod && npm install --omit=dev --ignore-scripts

# Production image
FROM node:22-alpine AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

WORKDIR /app

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/drizzle ./drizzle
COPY --from=builder /tmp/prod/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER fastify

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
