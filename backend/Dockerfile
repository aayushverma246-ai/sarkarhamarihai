# ── Stage 1: Build & Dependency Resolution ──
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files first for Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# ── Stage 2: Minimal Production Runner Stage ──
FROM node:22-alpine

WORKDIR /app

# Stream logs instantly instead of buffering
ENV NODE_ENV=production
ENV PORT=8080

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Expose production port
EXPOSE 8080

# Add non-root user for security (startup-grade container hardening)
USER node

# Run application
CMD ["node", "src/index.js"]
