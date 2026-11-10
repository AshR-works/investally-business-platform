# Image de l'interface web (Next.js, sortie « standalone »). Contexte de construction : la RACINE du dépôt.
#   docker build -f apps/crm-web/Dockerfile -t investally-web .
# CRM_API_URL est lue À LA CONSTRUCTION (les réécritures de Next.js sont figées dans le build) : dans la composition, l'API est « http://api:3001 ».
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/crm-web/package.json apps/crm-web/
RUN pnpm install --frozen-lockfile --filter @investally/crm-web...
COPY apps/crm-web apps/crm-web
ARG CRM_API_URL=http://api:3001
ENV CRM_API_URL=$CRM_API_URL NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @investally/crm-web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/crm-web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/crm-web/.next/static ./apps/crm-web/.next/static
COPY --from=build --chown=app:app /repo/apps/crm-web/public ./apps/crm-web/public
USER app
EXPOSE 3000
CMD ["node", "apps/crm-web/server.js"]
