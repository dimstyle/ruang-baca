# syntax=docker/dockerfile:1

# ============================================================================
# Stage 1: Build workspace packages (@ruangbaca/database, Tailwind CSS, NestJS)
# ============================================================================
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ \
  && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json tsconfig.build.json ./
COPY database/package.json database/tsconfig.json database/prisma.config.ts ./database/
COPY database/prisma ./database/prisma
COPY docs/uml/package.json ./docs/uml/

RUN pnpm install --frozen-lockfile

COPY database/src ./database/src
COPY styles ./styles
COPY public ./public
COPY views ./views
COPY src ./src
COPY scripts ./scripts
COPY docker ./docker

RUN pnpm build

# ============================================================================
# Stage 2: Production Runner (NestJS + PostgreSQL / SQLite runtime)
# ============================================================================
FROM node:22-alpine AS runner

RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database/package.json ./database/package.json
COPY --from=builder /app/database/node_modules ./database/node_modules
COPY --from=builder /app/database/dist ./database/dist
COPY --from=builder /app/database/prisma ./database/prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docker ./docker
COPY .env.example ./.env.example

RUN chmod +x ./docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
