# Stratégie de tests

## Pyramide
| Niveau | Cible | Outils | Part |
|---|---|---|---|
| Unitaires du Domain | Agrégats, VO, services de domaine — sans base, sans NestJS | Jest | majorité |
| Use cases | Application avec repositories en mémoire / faux ports | Jest | forte |
| Intégration | Repositories Prisma + mappers + contraintes (PostgreSQL réel en Docker) | Jest + Testcontainers | moyenne |
| Contrat/API | Endpoints, RBAC, validation, erreurs | Supertest | moyenne |
| Architecture | Règles de dépendances | dependency-cruiser / eslint-plugin-boundaries | obligatoire, bloquant |
| E2E | Parcours critiques (connexion+MFA, parcours prospect→offre→décharge) | Playwright | faible |
| Sécurité | Tests d'autorisation par rôle, injection, rate limiting | automatisés + revue | à chaque module |

## Règles d'architecture testées en CI
1. `domain/**` n'importe ni `@nestjs/*`, ni `@prisma/client`, ni `class-validator`, ni rien hors `domain/` et `shared-kernel/`.
2. `application/**` n'importe pas `@prisma/client` ni `infrastructure/**`.
3. `presentation/**` n'importe pas `@prisma/client` ni `infrastructure/**`.
4. Un module n'importe que l'`index.ts` public d'un autre module.
5. Pas de cycle entre modules.

## Contrat anti-IDOR
`test/idor-contract.spec.ts` (sans base) refuse toute route à identifiant non classée dans `test/support/idor-registry.ts` ; `test/idor-contract.integration.spec.ts` (PostgreSQL jetable) sonde chaque route « objet » avec deux acteurs sans portée. Ajouter une route `:id` impose donc d'écrire sa sonde.

## Tranche verticale (Sprint 1)
Preuve de câblage de bout en bout : créer une `Company` (BD) via Next.js → contrôleur → use case → agrégat → repository Prisma → PostgreSQL → ligne d'audit. Elle valide les frontières avant d'empiler les modules.

## Habitudes
- Tests écrits avec le code ; un bug = un test qui échoue d'abord.
- CI : lint, types, tests unitaires, tests d'architecture, intégration, build Docker, audit des dépendances.
- Aucun merge si la CI est rouge.
