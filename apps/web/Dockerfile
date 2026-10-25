# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
COPY packages/db/package.json packages/db/
RUN npm ci
COPY . .

# CDN host for /_next/static, baked in by Next.js: set by the `gc-scouting-web-cdn` build (production only), empty otherwise.
ARG ASSET_PREFIX=
ENV ASSET_PREFIX=${ASSET_PREFIX}
RUN npm run build -w apps/web

# Migration image (Argo CD PreSync Job): drizzle-orm and pg only, installed from packages/db/migrate/package-lock.json, plus the raw
# drizzle/ SQL folder and migrate.mjs. No drizzle-kit, esbuild or tsx: nothing to scan or patch beyond the base image.
FROM node:24-slim AS migrator-deps
WORKDIR /app
COPY packages/db/migrate/package.json packages/db/migrate/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-slim AS migrator
ENV NODE_ENV=production
# npm and corepack ship their own dependency copies and are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=migrator-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/db/migrate/package.json packages/db/migrate/migrate.mjs ./
COPY --chown=node:node packages/db/drizzle ./drizzle
USER node
CMD ["node", "migrate.mjs"]

FROM node:24-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# npm and corepack ship their own dependency copies and are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# server.js sits in apps/web of the standalone output, public/ and static files are not part of it.
WORKDIR /app/apps/web
COPY --from=build --chown=node:node /app/apps/web/.next/standalone /app
COPY --from=build --chown=node:node /app/apps/web/public ./public
COPY --from=build --chown=node:node /app/apps/web/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
