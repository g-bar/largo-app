# syntax=docker/dockerfile:1

# Two targets:
#   app   - production SvelteKit server (adapter-node), `node build`, port 3000
#   tools - migrations (drizzle-kit) and the synthetic seed, run once

ARG NODE_VERSION=24-bookworm-slim

# Shared base: Node + pnpm via corepack, pinned to the lockfile's pnpm.
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
WORKDIR /app

# Full dependency install (dev + prod), cached on the lockfile.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Build the SvelteKit app into build/.
FROM deps AS build
COPY . .
RUN pnpm build

# Production-only dependencies, pruned from the full store.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# ---- app: production image ----
FROM node:${NODE_VERSION} AS app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
EXPOSE 3000
USER node
CMD ["node", "build"]

# ---- tools: migrations + seed ----
# Needs the full deps (drizzle-kit), the migration SQL, the drizzle config, and the
# source tree (seed runs the TS directly under Node's native type stripping).
FROM deps AS tools
WORKDIR /app
ENV NODE_ENV=production
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
# Default: apply migrations. Override the command to run the seed when needed.
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]
