# 09 §4 — multi-stage, non-root, pinned base. api + worker in one process (PREFLIGHT_ROLE=all).
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
COPY bench ./bench
COPY rulebook ./rulebook
COPY builds/PreflightCore ./builds/PreflightCore
RUN pnpm install --frozen-lockfile --filter @preflight/api... --filter @preflight/worker...
RUN pnpm --filter @preflight/core --filter @preflight/rules-india --filter @preflight/rulegraph --filter @preflight/db --filter @preflight/api --filter @preflight/worker run build
RUN pnpm --filter @preflight/api --prod deploy /out/api

FROM base AS runtime
ENV NODE_ENV=production PREFLIGHT_RULEBOOK_DIR=/app/rulebook
COPY --from=build --chown=node:node /out/api /app
COPY --from=build --chown=node:node /app/rulebook /app/rulebook
COPY --chown=node:node infra/api-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD node -e "fetch('http://127.0.0.1:3000/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/entrypoint.sh"]
