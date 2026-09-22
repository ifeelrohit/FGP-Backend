# ==============================================================================
# FGP-Backend Multi-Stage Production Dockerfile
# Stage 1: Build & Bundle
# Stage 2: Minimal Distroless / Node.js Production Runner
# ==============================================================================

# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies for compilation
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Compile application bundle
RUN npm run build

# ---- Production Runner Stage ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install runtime dependencies for Prisma and OpenSSL
RUN apk add --no-cache openssl curl

# Create non-root system user
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs fgpuser

# Copy production artifacts from builder
COPY --from=builder --chown=fgpuser:nodejs /app/package*.json ./
COPY --from=builder --chown=fgpuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=fgpuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=fgpuser:nodejs /app/dist ./dist

USER fgpuser

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
