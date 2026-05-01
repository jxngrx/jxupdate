# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY apps/server ./apps/server

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @jxupdate/protocol build \
  && pnpm --filter @jxupdate/server build

ENV NODE_ENV=production
RUN addgroup -S jx && adduser -S jx -G jx && chown -R jx:jx /app
USER jx
EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]
