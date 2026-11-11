# Base de données Investally : guide, dictionnaire et vérifications

## Quel type de base ?
**PostgreSQL**, accédée par **Prisma** (client généré, migrations versionnées).

| Sujet | Réponse |
|---|---|
| Moteur | PostgreSQL ; en développement et en test, une instance embarquée jetable ; en production, un serveur PostgreSQL dans la composition de conteneurs |
| Organisation | Un **schéma PostgreSQL par contexte métier** : `iam` (comptes et droits), `bd` (commercial), `training` (formation), `hr` (ressources humaines), `docs` (documents), `audit` (journal) |
| Frontières | **Aucune clé étrangère entre deux schémas** : un contexte désigne un autre **par identifiant** ; l'existence est contrôlée par l'application (test `core-schema`) et par les vérifications ci-dessous |
| Intégrité | Clés étrangères en `RESTRICT`, contraintes `CHECK` et index uniques : une règle violée est refusée **même en contournant l'API** |
| Suppression | Jamais physique sur les données métier : archivage, annulation, suppression logique (`deleted_at`) |
| Concurrence | Colonne `version` sur chaque agrégat (verrou optimiste) |
| Audit | Table `audit.audit_logs` partitionnée par mois : qui, quoi, avant/après, session, adresse |
| Migrations | `apps/crm-api/prisma/migrations/` (28 au 2026-11-11), jamais modifiées une fois appliquées |

## Les documents
- [**DICTIONNAIRE.md**](DICTIONNAIRE.md) (généré) : les **43 tables**, leurs colonnes (type, nullité, défaut, description), clés, règles garanties par la base, index, types énumérés, un diagramme des relations par schéma, et la liste des références par identifiant.
- [**verifications.sql**](verifications.sql) : **22 vérifications d'intégrité en lecture seule**. Chacune renvoie zéro ligne quand tout va bien.

## Tester la base
```bash
DATABASE_URL=postgresql://… node scripts/db-docs/run-verifications.mjs        # affiche OK ou ÉCHEC pour chaque vérification ; code de sortie 1 s'il y a une anomalie
DATABASE_URL=postgresql://… node scripts/db-docs/run-verifications.mjs --json  # même chose, lisible par un outil
psql "$DATABASE_URL" -f docs/base-de-donnees/verifications.sql                 # sans Node : chaque résultat non vide est une anomalie
```
Elles couvrent ce que la base ne peut pas garantir seule : références entre contextes (apprenant → entreprise, inscription → agrément, entreprise → responsable, fiche employé → compte), cumuls (places d'une session, places et montant d'un agrément), cohérence entre tables (entreprise recopiée sur l'inscription, payeur d'un apprenant sans entreprise), chevauchement d'absences, solde de congé, comptes actifs sans rôle, second facteur sans secret, traces d'audit sans auteur.

**Résultat de référence** (pile jetable avec le jeu de démonstration et les parcours Postman) : **22 / 22**. Leur pouvoir de détection a été vérifié : cinq d'entre elles (responsable sorti, places dépassées, compte sans rôle, payeur incohérent, chevauchement d'absences) détectent bien une anomalie injectée dans une transaction annulée.

> **Postman ne sait pas interroger une base de données** : le test de la base se fait par ce script (ou `psql`), pas par la collection Postman. Les règles de la base sont aussi exercées indirectement par les tests d'API (la base refuse ce que l'API refuserait) et par les tests d'intégration du projet (`particuliers-http`, `hr-leave-http`, `core-schema`…).

## Régénérer le dictionnaire
```bash
DATABASE_URL=<base jetable migrée> node scripts/db-docs/build-dictionary.mjs
```
Le dictionnaire lit la **base réelle** (catalogue PostgreSQL) et les commentaires `///` de `schema.prisma` : pour documenter une colonne, commentez-la dans le schéma, puis régénérez.

## Précautions
- Les deux scripts sont en **lecture seule** (transaction en lecture seule), mais ne les pointez que vers une base dont vous avez le droit de lire les données personnelles.
- La base contient des **données personnelles** (contacts, apprenants, personnel) : le dictionnaire décrit la structure, jamais le contenu.
