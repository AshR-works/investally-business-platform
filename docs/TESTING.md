# Stratégie de tests

> **Règles, définition de « terminé » et fiches de test** : voir la [charte de tests](CHARTE-DE-TESTS.md) et les [fiches par interface et par session](tests/README.md). Ce document décrit la stratégie technique et tient le journal des tests par lot.

## Pyramide
| Niveau | Cible | Outils | Part |
|---|---|---|---|
| Unitaires du Domain | Agrégats, VO, services de domaine — sans base, sans NestJS | Jest | majorité |
| Use cases | Application avec repositories en mémoire / faux ports | Jest | forte |
| Intégration et API | Routes réelles (HTTP), RBAC, validation, erreurs, repositories Prisma, contraintes de la base, audit : base PostgreSQL **jetable** lancée par `apps/api/scripts/test-db.mjs` | Jest + helpers HTTP de `test/support` | moyenne |
| Interface | Logique des écrans, cohérence avec le domaine réel du serveur | Vitest (`apps/web/test`) | moyenne |
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

## Tests de mutation (scripts versionnés)
Un mutant est une faute injectée volontairement : on relance les tests, il doit échouer. Les scripts de chaque lot sont dans [`scripts/mutants/`](../scripts/mutants/README.md) (un script par lot, de S3.8 à S4.4a-bis) et se rejouent à la demande ; leurs résultats sont consignés dans la recette du lot et dans le journal ci-dessous. Ils modifient temporairement le code source : à lancer sur un arbre de travail propre, un seul à la fois.

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
| S4.4b — ambassadeurs | 856 réussis | 348 / 348 (24 suites) | 458 / 458 | 17 / 17 | 58 contrôles, 0 échec (parcours ciblé sur la page Ambassadeurs) |
| S4.4a-bis — agrément demandé, payeur, constat par la Finance, second facteur | 867 réussis | 352 / 352 (24 suites) | 467 / 467 | 23 / 23 | 64 contrôles, 0 échec (parcours ciblé sur la fiche entreprise et les ambassadeurs) |
| S4.4c — commissions à verser | 939 réussis | 375 / 375 (26 suites) | 518 / 518 | 28 / 28 | 86 contrôles, 0 échec, 0 violation (parcours ciblé sur la fiche entreprise, les agréments et la page Commissions, du justificatif au versement) |
| S5.2a — sessions de formation | 1005 réussis | 371 / 392 en une passe (21 dépassements de délai dans 4 suites, rejouées seules : 58 / 58) (28 suites) | 555 / 555 | 50 / 50 | non rejoué (parcours écrit dans `scripts/a11y-audit.mjs`, lancement refusé par l'environnement) |
| RH-2a — absences et congés (API) | API 1 293 unitaires (cas d'usage 72, calendrier 28, demande 15, règles 17, rôles 16) | intégration **466 / 466** (32 suites ; `hr-leave-http` 14 ; contrat anti-IDOR : 9 routes ajoutées) | **126 / 126 tués** (7 survivants rejoués) | sans objet (API seulement) |
| V1 — déploiement (images, relais Google, publication par domaine, sauvegardes) | API 1 160 unitaires, interface 680 | intégration **443 / 443** (31 suites ; publication : 6) | **61 mutants sur 62 tués** (1 équivalent) | non rejoué (D160) |
| RH-1 — annuaire du personnel (RH légère) | 1 092 réussis | personnel 10 passed, jeu de démonstration 8 passed (avant les écrans : IDOR, core-schema, administration 180 passed) ; CI de la PR #52 verte après correction d'un test partagé (D163) ; passe complète non rejouée | 669 / 669 | **56 / 56** (1 survivant rejoué et tué) | non rejoué (refusé, D160) |
| N1 à N6 — navigation, fiches, ambassadeurs, droits | 1056 réussis | 105 passed (ambassadeurs, IDOR ×2) + 12 (offres) + 11 (relances) ; passe complète non rejouée | 635 / 635 | non lancés | non rejoué (refusé, D160) |
| S5.2b — apprenants et inscriptions | 1041 réussis | 5 passed, 5 total (4 suites rejouées : inscriptions, sessions, IDOR, jeu) ; 118 passed, 118 total ; passe complète non rejouée | 571 / 571 (1 délai dépassé une fois sous charge, passe seul) | 69 / 69 | non rejoué (aucun parcours écrit ; le lancement de l'audit est refusé par l'environnement) |
| S5.1 — catalogue Investudy | 970 réussis | 375 / 383 en une passe (8 dépassements de délai dans `core-schema`) ; `core-schema` seule 20 / 20 (27 suites) | 536 / 536 | 49 / 49 | 69 contrôles, 0 échec, 0 violation (48 propres au catalogue) |
| Jeu de données de démonstration (module commercial) | 906 réussis | 358 / 358 (25 suites) | 508 / 508 | — (plan et couverture testés) | — (non rejoué : données vérifiées en base) |
| Correctifs 1 — téléphones, fenêtres, barres de défilement, tableaux | 879 réussis | 349 / 349 (24 suites) | 499 / 499 | 24 / 24 | 65 contrôles, 0 échec, 0 violation (parcours ciblé sur la fiche entreprise, les agréments et les ambassadeurs) |

Pour les lots antérieurs, les chiffres sont dans leurs recettes. Les sondes IDOR s'ajoutent avec chaque route « objet » (voir le contrat ci-dessus) ; les mutants sont des fautes injectées une à une (un test doit échouer à chaque fois) ; l'audit navigateur est `scripts/a11y-audit.mjs` (résultats dans `docs/accessibilite/resultats/`).

## Copie Excel du Gantt
`docs/GANTT-PROJET.xlsx` est régénérée avec le Gantt : `node docs/gantt/build.mjs && python docs/gantt/build-xlsx.py`.

