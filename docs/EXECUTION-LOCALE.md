# Exécuter et valider Investally sans Claude Code

*2026-10-22 · branche `sprint/execution-locale` · document de cadrage (décision attendue de la direction produit, voir §2).*

## 0. Constat sur l'existant (vérifié dans le dépôt)

| Élément | État réel | Conséquence |
|---|---|---|
| Modules livrés | Identité et accès (connexion, MFA, invitations, rôles, sessions), entreprises (Business Development), documents | On peut tester ces parcours **maintenant**. Opportunités, formations, finance, RH, reporting **n'existent pas encore** (S4 à S6) |
| Base de données | PostgreSQL 17 : `docker-compose.yml` (service `db`, port 5433) ou base embarquée jetable (`apps/crm-api/scripts/test-db.mjs`) | La base embarquée ne demande **ni Docker ni identifiants** |
| Docker | Non détecté sur le poste de l'assistant ; le `docker-compose.yml` ne contient **que la base et l'API** (profil `full`), pas l'interface web, pas de migration ni de seed | Le Docker complet demande du travail avant d'être utile |
| Node | `.nvmrc` = 22 ; le poste de l'assistant a Node 26.7 (Prisma 7 le supporte « officieusement ») | Installer Node 22 sur votre poste |
| Configuration | L'API refuse de démarrer en production sans clés (JWT, MFA, documents). En développement, clés **éphémères** : jetons et secrets MFA perdus à chaque redémarrage | Pour tester sur la durée, il faut des secrets **persistants** locaux |
| Premier compte | Commande `admin:create` (pas de mot de passe par défaut, MFA obligatoire) | Il faut une application TOTP (téléphone ou extension navigateur) |
| E-mails | `EMAIL_PROVIDER=log` : aucun e-mail réel ; les liens d'invitation s'écrivent dans la console de l'API (`EMAIL_LOG_CONTENT=true`) | Aucun accès Microsoft 365 nécessaire en local |
| Maquettes interactives | Prototype statique `docs/design/prototype/index.html` (+ `agenda.js`) | S'ouvre dans un navigateur, sans serveur |
| CI | `.github/workflows/ci.yml` : types, architecture, tests unitaires, migrations + intégration, audit | Déjà indépendante de Claude Code (nécessite un dépôt GitHub) |

## 1. Architecture d'exécution recommandée

```
Navigateur ──► Next.js 16 (127.0.0.1:3000) ──/api/*──► NestJS 11 (127.0.0.1:3001) ──► PostgreSQL 17 (127.0.0.1:54330)
 (mémoire : jeton)   (proxy même origine, CSP)           (ES256, RBAC, audit)           schémas bd / audit / iam / docs
                                                              └──► DOCUMENTS_DIR (disque local, 0700/0600)
                                                              └──► e-mails : console (EMAIL_PROVIDER=log)
```

| Couche | Local | Cible (production) |
|---|---|---|
| Frontend | `next start` (ou `next dev`) | Next.js derrière TLS |
| Backend | `node dist/src/main.js` | Conteneur Node 22 |
| Base | PostgreSQL embarqué **persistant** (dossier hors OneDrive) | PostgreSQL géré, sauvegardé |
| Stockage | Disque local (`DOCUMENTS_DIR`) via le port `ObjectStorage` | Adaptateur S3 (S7.1, dette D41) |
| Authentification | Réelle : argon2id, JWT ES256, MFA TOTP (clés locales persistantes) | Idem, clés en coffre |
| Tiers | Aucun (e-mails en console) | Microsoft 365 (S7), antivirus (S7.2, bloquant) |

## 2. Stratégie MVP : trois options (décision à prendre)

- **A. Interface seule, données simulées.** Le prototype HTML existe déjà ; l'application Next.js n'a pas de mode « données simulées », il faudrait en construire un et le maintenir.
- **B. Interface + API réelle + PostgreSQL embarqué, sans Docker.** Tout le vrai code, sécurité comprise, sur un poste Windows nu.
- **C. Docker complet.** Reproductible partout, mais le compose actuel est incomplet et Docker n'est pas installé.

| Critère (poids) | A | B | C |
|---|---|---|---|
| Fidélité au vrai produit (5) | 1 | 5 | 5 |
| Rapidité de mise en place (5) | 5 | 4 | 2 |
| Autonomie vis-à-vis de l'outil (4) | 5 | 5 | 4 |
| Reproductibilité / fiabilité (4) | 3 | 3 | 5 |
| Coût de maintenance (3) | 2 | 4 | 3 |
| **Total / 105** | **68** | **89** | **80** |

| | Avantages | Inconvénients | Effort | Pertinence Investally |
|---|---|---|---|---|
| A | Immédiat pour les maquettes | Ne teste ni sécurité, ni droits, ni données ; dérive vers le vrai produit | 1 jour + maintenance | Faible (le prototype couvre déjà ce besoin) |
| B | Vrai produit, aucun prérequis lourd, base persistante | Windows/Node 22 à soigner ; moins proche de la production qu'un conteneur | ½ jour (script écrit et testé) | **Forte** |
| C | Même environnement partout, prépare S7 | Docker Desktop à installer, compose à compléter (web, migration, seed, secrets), images à construire | 2 à 3 jours | Moyenne maintenant, forte en S7 |

**Recommandation (à confirmer par vous) : B maintenant, C en S7** (le Dockerfile et le compose existent comme base). Risques de B : divergence avec la production (réduite par la CI qui, elle, tourne sur PostgreSQL 17 réel) ; Node hors version (le script avertit). Réversible : aucun choix de B n'empêche C.

## 3. Arborescence (existante, sans bouleversement)

```
investally-platform/
├─ apps/crm-api/        NestJS, prisma/ (schéma, migrations), scripts/, src/modules/{iam,audit,business-development,documents}
├─ apps/crm-web/        Next.js (app/, components/, lib/, test/)
├─ docs/                architecture, sécurité, recettes, cadrages, design/ (prototype HTML), accessibilite/
├─ scripts/             local-stack.mjs (nouveau), a11y-audit.mjs, md-to-html.py
├─ .github/workflows/   ci.yml
├─ docker-compose.yml   (à compléter pour S7)
└─ ../investally-local/ HORS dépôt : pgdata/, documents/, logs/, secrets.json
```
Pas de `packages/` tant qu'un second consommateur (ERP) n'existe pas (ADR-0005). Un dossier `docker/` n'est utile qu'en S7.

## 4. Mise en place locale (option B)

**Prérequis** : Windows 10/11, Git, Node 22 LTS (via `nvm-windows` ou `fnm`), pnpm 12 (`corepack enable`), une application TOTP (téléphone, ou extension navigateur).

```bash
git clone <dépôt> C:\dev\investally-platform
cd C:\dev\investally-platform
git checkout main            # ou l'étiquette s3-6-validated
pnpm install
node scripts/local-stack.mjs --demo
```
Le script (`scripts/local-stack.mjs`, **testé le 2026-10-22 sur ports et dossier jetables, voir ci-dessous**) : génère des secrets locaux persistants, démarre PostgreSQL embarqué persistant (port 54330), applique les migrations, synchronise rôles/permissions, crée l'administrateur (mot de passe aléatoire affiché une seule fois), ajoute 40 entreprises fictives avec `--demo`, compile si nécessaire, démarre API et interface.

| Variable | Valeur locale | Source |
|---|---|---|
| `DATABASE_URL` | `postgresql://investally_local:<aléatoire>@127.0.0.1:54330/investally_local` | secrets.json |
| `JWT_PRIVATE_KEY_PEM` / `JWT_PUBLIC_KEY_PEM` | paire ES256 persistante | secrets.json |
| `MFA_ENCRYPTION_KEY` | 32 octets base64 persistants | secrets.json |
| `DOCUMENTS_DIR` | `..\investally-local\documents` | script |
| `ALLOWED_ORIGINS`, `APP_PUBLIC_URL` | `http://127.0.0.1:3000` | script |
| `EMAIL_PROVIDER`, `EMAIL_LOG_CONTENT` | `log`, `true` | script |

**Vérification** : `http://127.0.0.1:3000/login` s'affiche → connexion avec l'e-mail `admin@investally.test` → scan du QR → fiche entreprises remplie → `http://127.0.0.1:3001/api/docs` (Swagger). Commandes utiles : `--dev` (rechargement à chaud), `--rebuild`, `reset` (efface tout après confirmation). Les liens d'invitation sont dans `..\investally-local\logs\api.log`.

Qualité sans Claude Code : `pnpm ci` (types, architecture, tests) puis `node apps/crm-api/scripts/test-db.mjs` (intégration, base jetable).

**Test réalisé** (base, ports et dossier jetables, Node 26.7) : premier démarrage complet (6 migrations, 95 permissions, 10 rôles, administrateur, 40 entreprises) ; redémarrage : données conservées, aucun second administrateur, démonstration idempotente (0 ajout) ; interface 200, proxy `/api` 401 attendu, connexion par mot de passe réussie à travers le proxy. **Non testé** : l'enrôlement MFA dans le navigateur (à faire par vous), Node 22, `--dev`. Deux défauts corrigés pendant le test : interface compilée pour un autre port d'API (recompilation automatique), `next build` refusait `NODE_ENV=development`.

## 5. Docker : pas maintenant

À faire en S7 : service `web`, étape de migration, secrets par fichier, utilisateur non-root, healthchecks, image API en `--prod` (le Dockerfile actuel copie tout le dépôt avec ses dépendances de développement), réseau interne, sauvegarde du volume documents. Avantages : reproductible, proche de la production. Inconvénients : installation de Docker Desktop (WSL2, licence selon l'organisation), images à maintenir, débogage plus lent.

## 6. Base de données

| Usage | Choix |
|---|---|
| Développement et recette manuelle | PostgreSQL embarqué **persistant** (script) ; si vous préférez une installation, PostgreSQL 17 natif avec une base dédiée **jamais celle de production** |
| Tests automatiques | PostgreSQL embarqué **jetable** (`test-db.mjs`) + service PostgreSQL 17 de la CI |
| Préproduction / production | PostgreSQL 17 géré (ou conteneur en S7), sauvegardes testées |

Recommandation : embarqué persistant en local, PostgreSQL 17 réel en CI (déjà le cas).

## 7. Stratégie de tests

| Type | Outils | Fréquence | Priorité |
|---|---|---|---|
| API et droits | Jest + Supertest (matrice rôle × route) | À chaque commit (CI) | 1 |
| Intégration | Jest + base PostgreSQL jetable | À chaque PR | 1 |
| Architecture | dependency-cruiser | À chaque PR | 1 |
| Fonctionnels / parcours | Manuel guidé (§8 scénarios) maintenant ; **Playwright** à ajouter pour connexion+MFA et parcours prospect → offre | À chaque session livrée | 2 |
| Accessibilité | `scripts/a11y-audit.mjs` + écoute NVDA (D31) | Chaque écran nouveau | 2 |
| UX / utilisateurs | Atelier de cadrage UX + tests avec 3 à 5 utilisateurs | Avant S4.1, puis chaque lot | 2 |

## 8. Données de démonstration

Principe : **fictives, générées, idempotentes, jamais de données réelles**, comptes d'un domaine `.test`.

| Module | Maintenant | Quand |
|---|---|---|
| CRM : entreprises | 40 entreprises (secteurs, pays, statuts) via `--demo` | Prêt |
| Documents | Envoi manuel d'un PDF/PNG de test | Prêt |
| Comptes | 1 SuperAdmin + **un compte par rôle** (`--demo`) : `direction@`, `commercial@`, `compte1@`, `compte2@` (deux chargés de compte pour tester la portée « propres objets »), `investudy@`, `formateur@`, `support@`, `finance@`, `rh@`, `fiscalite@` + `demo.investally.test`. Mots de passe **aléatoires par compte**, conservés dans `..\investally-local\demo-accounts.json` ; MFA à enrôler à la première connexion ; commande interdite en production. Les 40 entreprises sont réparties 20/20 entre `compte1` et `compte2` ; `compte1/2` ont pour responsable `commercial`, `formateur` pour responsable `investudy` | Prêt |
| Contacts, offres, décharges, relances, opportunités, agenda | Seed scénarisé « un prospect de A à Z » | S4.1 à S4.4 |
| Formations (Investudy) | Sessions, inscrits, présences | S5 |
| Finance, RH | Facture, paie fictives | Après S5 (ERP) |
| Reporting | Calculé sur les données ci-dessus | S6 |

Scénarios testables dès maintenant : (1) premier administrateur, MFA, déconnexion ; (2) invitation d'un collaborateur, activation, droits par rôle ; (3) liste et filtres des entreprises ; (4) envoi, nouvelle version, téléchargement, archivage d'un document ; (5) sessions actives et révocation ; (6) refus d'accès hors périmètre (404).

## 9. Environnements

| | Objectif | Configuration | Public | Données |
|---|---|---|---|---|
| LOCAL | Développer, recetter | Option B, secrets locaux | Vous, développeurs | Fictives |
| DEV | Intégration continue partagée | Conteneurs (S7), déploiement auto depuis `main` | Équipe technique | Fictives |
| PREPROD | Répétition de la production, recette métier | Même configuration que PROD, antivirus, Microsoft 365 de test, TLS | Direction, utilisateurs pilotes | Anonymisées ou fictives |
| PROD | Exploitation | Clés en coffre, sauvegardes, supervision, S3, antivirus | Tous | Réelles |

## 10. Roadmap d'exécution

1. **Maquettes** (déjà : prototype HTML v0.4.1 + registre EXD).
2. **Application locale** (cette étape : option B, validation de votre poste, ½ jour).
3. **Backend réel écran par écran** (S4 à S6, déjà la méthode).
4. **Conteneurisation + DEV** (début S7.1 : compose complet, S3, sauvegardes).
5. **Préproduction** (S7.2 : antivirus bloquant, Microsoft 365, avis juridique, deux SuperAdmins, écoute lecteur d'écran, test de restauration).
6. **Production** (go de la direction, plan de retour arrière).

## Points à décider par vous
1. Option B maintenant puis C en S7 (recommandée), ou autre.
2. ~~Tester le script~~ fait (voir §4) ; reste votre essai sur votre poste avec Node 22.
3. ~~Un compte par rôle~~ fait (§8).
4. Ajouter Playwright (parcours connexion + MFA) dans une prochaine session ?
