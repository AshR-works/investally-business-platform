FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @investally/crm-api...
COPY apps/api apps/api
RUN pnpm --filter @investally/crm-api prisma:generate && pnpm --filter @investally/crm-api build

FROM node:22-alpine AS run
WORKDIR /repo/apps/api
# API_HOST=0.0.0.0 : l'API écoute sur le réseau INTERNE de la composition (le serveur web est un autre conteneur) ; aucun port n'est publié sur la machine.
ENV NODE_ENV=production API_HOST=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
# Documents téléversés : volume monté ici (DOCUMENTS_DIR=/data/documents), propriété de l'utilisateur de l'application.
RUN mkdir -p /data/documents && chown app:app /data/documents
COPY --from=build --chown=app:app /repo /repo
USER app
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
