FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/crm-api/package.json apps/crm-api/
RUN pnpm install --frozen-lockfile --filter @investally/crm-api...
COPY apps/crm-api apps/crm-api
RUN pnpm --filter @investally/crm-api prisma:generate && pnpm --filter @investally/crm-api build

FROM node:22-alpine AS run
WORKDIR /repo/apps/crm-api
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo /repo
USER app
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
