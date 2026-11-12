# Base de données V1 (production)

*2026-11-12 · Complète [EXPLOITATION-V1](../EXPLOITATION-V1.md) · Le serveur de production **n'existe pas encore** (hébergement non décidé) : cette V1 est une base **décrite, figée, vérifiable et répétée en local**, prête à être installée le jour où le serveur existe.*

## Ce qu'est la V1
Une base PostgreSQL **neuve**, obtenue en appliquant **les 31 migrations** du dépôt puis en chargeant les **rôles et les droits** (c'est exactement ce que fait le service `migrate` de la composition de production : `prisma migrate deploy` puis `seed-core`). Elle contient :

| Contenu | Détail |
|---|---|
| **Schémas et tables** | 6 schémas (`iam`, `bd`, `training`, `hr`, `docs`, `audit`), **50 tables** ([dictionnaire](DICTIONNAIRE.md)) |
| **Données de référence** (livrées avec la base) | 10 rôles, 124 permissions, 442 attributions ; règles de congés (1) et 5 types d'absence ; 4 types de contrat ; 2 modèles de parcours (11 tâches). Le détail est dans [V1-MANIFESTE.json](V1-MANIFESTE.json) |
| **Aucun compte** | Il n'existe aucun utilisateur : le premier super administrateur se crée à la main ([EXPLOITATION-V1, § 3](../EXPLOITATION-V1.md)) |
| **Aucune donnée métier** | Ni entreprise, ni apprenant, ni employé, ni démonstration. Le jeu de démonstration n'est **jamais** chargé en production |

## Les règles de la V1
1. **Une migration de la V1 ne se modifie jamais.** Le manifeste garde le nom et la somme de contrôle de chacune des 31 ; un test unitaire (`v1-manifest.spec.ts`) et le script `v1-manifest.mjs` échouent si l'une change, disparaît ou si une migration est insérée avant la fin de la V1.
2. **Les évolutions s'ajoutent après** : une nouvelle migration (nom daté plus récent) est permise, listée « après la V1 », et la base de production la reçoit à la mise à jour suivante (sauvegarde d'abord, [EXPLOITATION-V1, § 4](../EXPLOITATION-V1.md)).
3. **Les droits et les rôles viennent du code** (`seed-core`), rejoué à chaque démarrage : leur nombre peut croître après la V1, il ne doit jamais manquer (le contrôle dit « au moins »).

## Vérifier une base
```bash
# Dépôt seul (sans base) : les migrations de la V1 sont-elles intactes ?
node scripts/db-docs/v1-manifest.mjs check

# Une base : migrations appliquées avec les mêmes sommes de contrôle, données de référence présentes ;
# --fresh exige en plus qu'AUCUNE donnée métier n'existe (base neuve, avant le premier compte)
DATABASE_URL=postgresql://… node scripts/db-docs/v1-manifest.mjs check --fresh

# Les 22 vérifications d'intégrité (lecture seule), voir README
DATABASE_URL=postgresql://… node scripts/db-docs/run-verifications.mjs
```
Les deux scripts sont en **lecture seule**. Sortie : code 0 si tout est conforme, 1 sinon.

## La répéter en local (sans serveur, sans Docker)
```bash
node scripts/local-stack.mjs --db-only          # variables : INVESTALLY_LOCAL_HOME, LOCAL_DB_PORT
```
Démarre **la base seule** : migrations et rôles, aucun compte, ni API ni interface ; contrôle le manifeste en mode `--fresh` puis les 22 vérifications ; la base reste ouverte (Ctrl+C pour l'arrêter) et ses données sont conservées. Résultat de référence (2026-11-12) : **31 migrations appliquées avec les mêmes sommes de contrôle, base neuve, 22 / 22 vérifications**.

## Installer en production (le jour venu)
1. Serveur, domaine et relais d'e-mail prêts ([EXPLOITATION-V1, § 2](../EXPLOITATION-V1.md)).
2. `docker compose -f docker-compose.prod.yml up -d --build` : le service `migrate` construit la base V1.
3. Vérifier : `DATABASE_URL=… node scripts/db-docs/v1-manifest.mjs check --fresh`.
4. Créer le premier, puis un second super administrateur ([EXPLOITATION-V1, § 3](../EXPLOITATION-V1.md)).
5. Faire une **première sauvegarde** et vérifier qu'elle se restaure ([EXPLOITATION-V1, § 6](../EXPLOITATION-V1.md)).

## Ce qui reste ouvert
- **Hébergement, domaine, emplacement des sauvegardes hors du serveur** : décisions de la Direction produit, non prises (D60 à D63 posent le cadre, pas les choix).
- **Durée de conservation des données du personnel** (dont les présences, D189) : à valider avec l'avis juridique avant la mise en production.
- **Jamais exécuté sur un vrai serveur** : la composition de production n'a pas été lancée (aucun Docker sur la machine de développement) ; seule la base V1 a été répétée, avec le moteur PostgreSQL embarqué (PostgreSQL 17).
- **Pas de sauvegarde de la V1 répétée en local** : l'outil `pg_dump` n'est pas disponible avec le moteur embarqué ; la restauration reste à éprouver avec le service `backup` de la composition.
