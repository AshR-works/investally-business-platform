# Sprint 1 — Plan de recette (validation avant clôture)

Le sprint n'est **validé** que lorsque toutes les lignes « Bloquant » sont ✅. Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable.

## A. Architecture et qualité statique
| # | Contrôle | Commande | Bloquant | Statut |
|---|---|---|---|---|
| A1 | Types API sans erreur | `pnpm crm-api typecheck` | oui | ✅ (2026-10-20) |
| A2 | Types Web sans erreur | `pnpm crm-web typecheck` | oui | ✅ |
| A3 | Règles de dépendances (Domain pur, Application sans Prisma/HTTP, Presentation sans Prisma, frontières de module, pas de cycle) | `pnpm arch` | oui | ✅ |
| A4 | Les règles bloquent réellement (violations volontaires détectées) | manuel, voir historique S1 | oui | ✅ (4/4 types de violation) |
| A5 | Build de production API | `pnpm crm-api build` | oui | ✅ (démarre en ≈10 s, sortie `dist/src/main.js`) |
| A6 | Build de production Web | `pnpm crm-web build` | oui | ✅ |
| A7 | Aucun secret versionné (`.env`, mots de passe) | `git grep -i -E "password\|secret"` + revue | oui | ✅ (seul secret en clair : mot de passe jetable de la base CI) |

## B. Tests automatisés sans base
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| B1 | Domain : Company, CompanyName, événements | oui | ✅ |
| B2 | Use case RegisterCompany : succès + audit, doublon, validation | oui | ✅ |
| B3 | UUID v7 : format et tri | oui | ✅ |
| B4 | Démarrage de l'application : DI, `/health/live`, validation stricte, `problem+json`, plafond de pagination | oui | ✅ |

## C. Tests avec PostgreSQL (base de test **dédiée**, jamais la base de travail)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| C1 | `prisma migrate deploy` s'applique sur base vide | oui | ✅ |
| C2 | Migrations à jour (`migrate status`). Le diff Prisma exact n'est pas applicable : l'index unique partiel, la contrainte CHECK et le déclencheur d'audit sont du SQL hors schéma Prisma | oui | ✅ |
| C3 | Enregistrement + ligne d'audit dans la même transaction | oui | ✅ |
| C4 | Rollback de l'entreprise si l'audit échoue | oui | ✅ |
| C5 | Doublon refusé (applicatif **et** index unique partiel) | oui | ✅ applicatif (test + navigateur) ; l'index partiel seul n'est pas testé isolément (dette) |
| C6 | `UPDATE`/`DELETE` sur `audit.audit_logs` refusés par la base | oui | ✅ UPDATE ; DELETE non testé isolément (même déclencheur) |
| C8 | Horodatages enregistrés en UTC (défaut trouvé : décalage d'1 h si le fuseau serveur ≠ UTC) | oui | ✅ corrigé, test de non-régression vérifié rouge sans correctif |
| C7 | `/health/ready` : OK base up, 503 base arrêtée | oui | ✅ (200 base up, 503 base arrêtée) |

## D. Bout en bout (API + Web)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| D1 | Créer une entreprise depuis la page web, elle apparaît dans la liste | oui | ✅ (navigateur réel, pile complète) |
| D2 | Un doublon affiche un message d'erreur lisible | non | ✅ (insensible à la casse et aux accents) |
| D3 | Swagger `/api/docs` décrit les endpoints | non | ✅ (HTTP 200 sur le build compilé) |

## E. Sécurité de base du sprint
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| E1 | API n'écoute que sur 127.0.0.1 (pas d'auth avant S3) | oui | ✅ (code) |
| E2 | Champs inconnus refusés, tailles bornées, injection SQL non possible | oui | ✅ (B4 + injection `' OR 1=1; DROP TABLE` dans la recherche : 0 résultat, table intacte) |
| E3 | Audit d'une écriture contient IP et appareil | oui | ✅ (C3) |
| E4 | `pnpm audit --prod` sans vulnérabilité haute | non | ✅ (0 haute ; 1 moyenne js-yaml via swagger, acceptée : TECH-DEBT D6) |

## F. Infra (non vérifiable localement : Docker absent)
| # | Contrôle | Statut |
|---|---|---|
| F1 | `docker compose up db` démarre PostgreSQL | ➖ à tester sur une machine avec Docker |
| F2 | Image API construite et démarrée | ➖ idem |
| F3 | Pipeline CI verte sur la pull request | ⏳ après poussée sur le dépôt distant |

## Décision de validation
- **Validé** : tous les « Bloquant » ✅.
- **Validé avec réserves** : seuls F1–F3 restent ➖/⏳, consignés comme dette dans `docs/TECH-DEBT.md`.
- Sinon : correctifs, puis nouvelle recette.
