FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS base

WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

FROM deps AS build

COPY . .

RUN npm run build --workspace @hakimi/shared
RUN npm run build --workspace @hakimi/api

FROM base AS runtime

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev

RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/bin/pnpm \
    /usr/local/bin/pnpx \
    /opt/yarn-v1.22.22

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/database ./apps/api/dist/apps/api/database
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/apps/api/dist/apps/api/src

USER node

EXPOSE 3001

CMD ["node", "server.js"]
