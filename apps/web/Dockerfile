# Build from the repository root: docker build -f apps/web/Dockerfile .
# Targets: `runner` (default, the site) and `migrator` (the PreSync Job running drizzle-kit migrate).
FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
COPY packages/db/package.json packages/db/
RUN npm ci
COPY . .
RUN npm run build -w apps/web

# Needs drizzle-kit (devDependency) and the raw drizzle/ SQL folder, neither of which ship in the standalone image.
FROM build AS migrator
WORKDIR /app/packages/db
# npm and corepack ship their own dependency copies and are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
CMD ["/app/node_modules/.bin/drizzle-kit", "migrate"]

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
