# ==============================================================================
# MULTI-STAGE DOCKERFILE FOR PRODUCTION (Node 22 LTS Alpine)
# ==============================================================================

# Stage 1: Build Frontend and Server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend and bundled server
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install postgresql-client for pg_isready and backup scripts
RUN apk add --no-cache postgresql-client ca-certificates tzdata

# Set timezone to Asia/Ho_Chi_Minh
ENV TZ=Asia/Ho_Chi_Minh

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built distribution assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/data ./data
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Create storage directories with permissions
RUN mkdir -p /app/data/storage /app/data/contracts && chown -R node:node /app

# Run as non-root node user
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

CMD ["node", "dist-server/server.js"]

