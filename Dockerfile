FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build tools for native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy root manifest, base tsconfig, and workspaces
COPY package*.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install dependencies across workspaces
RUN npm install

# Build shared packages and api
RUN npm run build --workspace=@verdict/shared && \
    npm run build --workspace=@verdict/verdict-engine && \
    npm run build --workspace=@verdict/api

# Ensure schema.sql and migrations exist alongside compiled dist/db
RUN cp apps/api/src/db/schema.sql apps/api/dist/db/schema.sql && \
    cp -r apps/api/src/db/migrations apps/api/dist/db/migrations

# Verify SQLite works in builder
RUN node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); console.log('Builder SQLite check:', db.prepare('SELECT 1 as ok').get());"

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

# Install curl and sqlite3 runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

# Verify SQLite works in production image
RUN node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); console.log('Prod SQLite check:', db.prepare('SELECT 1 as ok').get());"

# Create volume mount directory
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=4000
ENV VERDICT_DB_PATH=/data/verdict.db

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=apps/api"]
