# Investally Business Platform

Deux produits dans un monorepo (ADR-0005) : **CRM** (prioritaire : Business Development + Investudy) et **ERP** (plus tard).
Documentation : `docs/` (vision, architecture, ADR, risques, plan des sprints).

## Prérequis
- Node 22 LTS (`.nvmrc`) — Prisma 7 ne supporte pas officiellement Node 26.
- pnpm 12, PostgreSQL 17+ (ou Docker).

## Démarrage CRM API
```bash
pnpm install
cp .env.example apps/crm-api/.env        # renseigner DATABASE_URL (jamais committé)
pnpm crm-api prisma:generate
pnpm crm-api prisma:migrate:deploy        # sur une base dédiée
pnpm crm-api start:dev                    # http://127.0.0.1:3001/api/docs
```

## Qualité (tout est bloquant en CI)
```bash
pnpm typecheck     # types
pnpm arch          # règles de dépendances Clean Architecture (dependency-cruiser)
pnpm test          # tests unitaires + démarrage de l'application (sans base)
pnpm crm-api test:integration   # nécessite DATABASE_URL vers une base de TEST migrée
```

## Statut Sprint 1
API CRM : tranche verticale `Company` (enregistrer, lister) avec audit transactionnel.
**Pas d'authentification avant S3** : l'API n'écoute que sur 127.0.0.1 ; ne jamais l'exposer.
