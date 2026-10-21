/** Contrat d'architecture (docs/ARCHITECTURE.md). Toute violation fait échouer la CI. */
const MODULES = '^apps/crm-api/src/modules/([^/]+)';

module.exports = {
  forbidden: [
    {
      name: 'stock-sans-dependance-crm',
      comment:
        "ADR-0007 : le module Stocks est autonome (hébergé dans le monolithe, conçu pour être extrait vers l'ERP). Il n'importe AUCUN module métier du CRM ; seuls shared-kernel et les interfaces publiques de iam, audit et notifications lui sont ouverts.",
      severity: 'error',
      from: { path: '^apps/crm-api/src/modules/stock' },
      to: { path: '^apps/crm-api/src/modules/(business-development|training|agenda|reporting)' },
    },
    {
      name: 'domain-pur',
      comment:
        "Le Domain ne dépend ni de NestJS, ni de Prisma, ni de class-validator, ni d'une autre couche.",
      severity: 'error',
      from: { path: `${MODULES}/domain` },
      to: {
        path: [
          'node_modules/@nestjs',
          'node_modules/@prisma',
          'node_modules/class-validator',
          'node_modules/class-transformer',
          'node_modules/express',
          'node_modules/uuid',
          `${MODULES}/(application|infrastructure|presentation)`,
          '^apps/crm-api/src/platform',
        ],
      },
    },
    {
      name: 'shared-kernel-pur',
      severity: 'error',
      from: { path: '^apps/crm-api/src/shared-kernel' },
      to: {
        path: ['node_modules/@nestjs', 'node_modules/@prisma', '^apps/crm-api/src/modules', '^apps/crm-api/src/platform'],
      },
    },
    {
      name: 'application-sans-persistance-ni-http',
      comment: 'Application : ni Prisma/SQL, ni HTTP, ni Infrastructure, ni Presentation.',
      severity: 'error',
      from: { path: `${MODULES}/application` },
      to: {
        path: [
          'node_modules/@prisma',
          'node_modules/express',
          'node_modules/pg',
          `${MODULES}/(infrastructure|presentation)`,
          '^apps/crm-api/src/platform',
        ],
      },
    },
    {
      name: 'presentation-sans-persistance',
      comment: "Un controller n'accède jamais à Prisma, à l'Infrastructure ni au Domain directement.",
      severity: 'error',
      from: { path: `${MODULES}/presentation` },
      to: {
        path: ['node_modules/@prisma', `${MODULES}/infrastructure`, `${MODULES}/domain`, '^apps/crm-api/src/platform'],
      },
    },
    {
      name: 'prisma-confine',
      comment: 'Seuls infrastructure/ et platform/ importent Prisma (ou son client généré).',
      severity: 'error',
      from: { pathNot: [`${MODULES}/infrastructure`, '^apps/crm-api/src/platform', '^apps/crm-api/prisma'] },
      to: { path: ['node_modules/@prisma', 'apps/crm-api/generated/prisma'] },
    },
    {
      name: 'frontiere-de-module',
      comment:
        "Un module n'importe d'un autre module que son index.ts public (ou son *.module.ts, pour la composition).",
      severity: 'error',
      from: { path: `${MODULES}/` },
      to: {
        path: '^apps/crm-api/src/modules/',
        pathNot: [
          '^apps/crm-api/src/modules/$1/',
          '^apps/crm-api/src/modules/[^/]+/index\\.ts$',
          '^apps/crm-api/src/modules/[^/]+/[^/]+\\.module\\.ts$',
        ],
      },
    },
    { name: 'pas-de-cycle', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules|apps/crm-api/generated' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.spec\\.ts$' },
  },
};
