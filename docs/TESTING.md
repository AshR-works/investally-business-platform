# Stratégie de tests

> **Règles, définition de « terminé » et fiches de test** : voir la [charte de tests](CHARTE-DE-TESTS.md) et les [fiches par interface et par session](tests/README.md). Ce document décrit la stratégie technique et tient le journal des tests par lot.

## Pyramide
| Niveau | Cible | Outils | Part |
|---|---|---|---|
| Unitaires du Domain | Agrégats, VO, services de domaine — sans base, sans NestJS | Jest | majorité |
| Use cases | Application avec repositories en mémoire / faux ports | Jest | forte |
| Intégration et API | Routes réelles (HTTP), RBAC, validation, erreurs, repositories Prisma, contraintes de la base, audit : base PostgreSQL **jetable** lancée par `apps/crm-api/scripts/test-db.mjs` | Jest + helpers HTTP de `test/support` | moyenne |
| Interface | Logique des écrans, cohérence avec le domaine réel du serveur | Vitest (`apps/crm-web/test`) | moyenne |
| Mutation | Les tests détectent-ils les fautes injectées ? | scripts `scripts/mutants/` | chaque lot |
| Architecture | Règles de dépendances | dependency-cruiser / eslint-plugin-boundaries | obligatoire, bloquant |
| Navigateur réel et accessibilité | Parcours scriptés dans Edge sans fenêtre, axe-core à chaque état d'écran (Playwright non retenu) | `scripts/a11y-audit.mjs` | chaque lot qui touche un écran |
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

## Journal des tests par lot
Mis à jour **à chaque lot**, en même temps que le code (règle posée le 2026-11-01) : chiffres relevés avant la demande de validation ; le détail se trouve dans la recette du lot (`SPRINT-*-RECETTE.md`).

| Lot | Tests unitaires API | Intégration (PostgreSQL jetable) | Interface | Mutants tués | Navigateur réel (Edge + axe) |
|---|---|---|---|---|---|
| S4.2c — relances | 679 / 679 | 268 / 268 | 308 / 308 | 15 / 15 | 77 contrôles, 0 échec (parcours limité) |
| S4.2d — agenda | 729 / 729 | 286 / 286 (20 suites) | 357 / 357 | 24 / 24 | 91 contrôles, 0 échec (parcours limité) |
| S4.3a — opportunités | 780 réussis | 306 / 306 (21 suites) | 390 / 390 | 24 / 24 | 105 contrôles, 0 échec (parcours limité) |
| S4.3b — statuts, responsable, fiche 360° | 797 réussis | 319 / 319 (22 suites) | 400 / 400 | 21 / 21 | 38 contrôles, 0 échec (parcours ciblé sur la fiche entreprise) |
| S4.3c — valeur et lien rendez-vous | 804 réussis | 322 / 322 (22 suites) | 408 / 408 | 14 / 14 | 43 contrôles, 0 échec (parcours ciblé sur la fiche entreprise et l'agenda) |
| S4.4a — agréments | 833 réussis | 338 / 338 (23 suites) | 433 / 433 | 18 / 18 | 51 contrôles, 0 échec (parcours ciblé sur la fiche entreprise) |

Pour les lots antérieurs, les chiffres sont dans leurs recettes. Les sondes IDOR s'ajoutent avec chaque route « objet » (voir le contrat ci-dessus) ; les mutants sont des fautes injectées une à une (un test doit échouer à chaque fois) ; l'audit navigateur est `scripts/a11y-audit.mjs` (résultats dans `docs/accessibilite/resultats/`).

## Copie Excel du Gantt
`docs/GANTT-PROJET.xlsx` est régénérée avec le Gantt : `node docs/gantt/build.mjs && python docs/gantt/build-xlsx.py`.

