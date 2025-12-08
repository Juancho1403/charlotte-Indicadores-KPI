# Node.js 20 slim image for production
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies needed by Prisma's engine
RUN apk add --no-cache openssl

# Only copy package manifests first for better caching
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies (respect package manager if lockfile exists)
RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable; pnpm install --frozen-lockfile; \
    else npm ci; fi

# Copy the rest of the source
COPY . .

# Generate Prisma Client
# Requires DATABASE_URL at build time only if schema needs preview features
# We skip migrations here; they should run at container startup or via CI/CD
RUN npx prisma generate

# Expose app port
ENV PORT=3000
EXPOSE 3000

# Runtime env vars expected:
# DATABASE_URL: pooled connection string (Supavisor)
# DIRECT_URL: direct connection string (for prisma CLI if used inside container)
# Optionally set NODE_ENV
ENV NODE_ENV=production

# Start the API
CMD ["node", "src/index.js"]
