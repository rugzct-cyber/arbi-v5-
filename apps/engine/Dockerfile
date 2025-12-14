FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Copy packages
COPY packages ./packages
COPY apps/engine ./apps/engine

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
RUN pnpm --filter engine build

# Production
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/engine/dist ./dist
COPY --from=builder /app/apps/engine/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
