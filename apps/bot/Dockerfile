# Build from the repository root: docker build -f apps/bot/Dockerfile .
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN npm ci --omit=dev -w apps/bot

FROM node:24-slim
ENV NODE_ENV=production PORT=8788
# npm and corepack ship their own dependency copies and are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app/apps/bot
COPY --from=deps --chown=node:node /app/node_modules /app/node_modules
COPY --chown=node:node packages/db /app/packages/db
# The bot reads the site labels (regions, roles...) from its translation files.
COPY --chown=node:node apps/web/src/messages /app/apps/web/src/messages
COPY --chown=node:node apps/bot/package.json apps/bot/tsconfig.json ./
COPY --chown=node:node apps/bot/src ./src
USER node
EXPOSE 8788
CMD ["node", "--import", "tsx", "src/index.ts"]
