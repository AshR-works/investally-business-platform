# Livrable 2 — Guide du code

*Pour qui ?* Toute personne qui ouvre le code pour la première fois (nouvel ingénieur, relecteur, auditeur). *Objectif :* trouver en moins de cinq minutes **où** vit chaque comportement, **comment** une requête traverse l'application et **comment** ajouter une fonctionnalité sans casser les règles.

> Les fonctions elles-mêmes sont commentées dans le code (535 déclarations). Leur liste complète, avec leur rôle en une phrase, est dans [03-INDEX-DES-FONCTIONS.md](03-INDEX-DES-FONCTIONS.md) (document généré).

## 1. Vue d'ensemble

```
investally-platform/
├── apps/
│   ├── crm-api/          API (NestJS) — toute la logique, tous les contrôles de sécurité
│   │   ├── src/
│   │   │   ├── shared-kernel/      vocabulaire commun (erreurs, ports, événements) — sans dépendance
│   │   │   ├── platform/           technique commun : base de données, configuration, horloge, gardes globales
│   │   │   └── modules/            un dossier par contexte métier
│   │   │       ├── audit/                journal d'audit en ajout seul
│   │   │       ├── notifications/        envoi d'e-mails (journal en dev, Microsoft 365 en prod)
│   │   │       ├── iam/                  comptes, connexion, MFA, sessions, rôles, invitations, mot de passe oublié
│   │   │       └── business-development/ entreprises cibles (début du pipeline commercial)
│   │   ├── prisma/                 schéma de base de données et migrations (SQL versionné)
│   │   ├── scripts/                outils (base de test jetable, clés, seed, documents générés)
│   │   └── test/                   tests de bout en bout et matrices de droits
│   └── crm-web/          Interface (Next.js / React) — aucune règle de sécurité n'y est « décisive »
│       ├── app/                    pages (connexion, MFA, invitation, mot de passe oublié, administration, compte)
│       ├── components/             composants partagés (fenêtre modale, confirmation MFA, garde d'accès)
│       └── lib/                    client HTTP, état d'authentification, droits, utilitaires
├── docs/                 documentation (architecture, sécurité, recettes, registre des décisions, livrables)
└── scripts/              outils du dépôt (index des fonctions)
```

**Règle d'or** : l'interface *affiche* ce que l'utilisateur peut faire ; c'est l'API qui *décide*. Chaque requête est re-contrôlée côté serveur.

## 2. Les quatre couches d'un module

Chaque module de l'API est découpé de la même façon, et des règles automatiques (`pnpm arch`, outil *dependency-cruiser*) **font échouer la CI** si une couche importe ce qu'elle n'a pas le droit d'importer.

| Couche | Contient | Peut dépendre de | Exemple |
|---|---|---|---|
| `domain/` | Règles métier pures : entités, objets-valeurs, politiques, **ports** (interfaces) | rien (ni framework, ni base) | `user.ts` (verrouillage progressif), `access-policy.ts` (qui peut quoi), `password-policy.ts` |
| `application/` | **Cas d'usage** : un fichier = une action de l'utilisateur ; orchestre le domaine et les ports | domaine | `login.use-case.ts`, `password-reset.use-cases.ts` |
| `infrastructure/` | Adaptateurs concrets : PostgreSQL (Prisma), argon2, JWT, e-mail | domaine, application | `prisma-user.repository.ts`, `es256-access-token.service.ts` |
| `presentation/` | Routes HTTP, validation des entrées, gardes, cookies | application | `auth.controller.ts`, `admin.controllers.ts`, `protected.decorator.ts` |

Pourquoi ? Pour que les règles métier ne dépendent d'aucune technologie : on peut changer de base, de framework ou migrer vers .NET **sans réécrire le métier** (ADR-0002, ADR-0003).

## 3. Le chemin d'une requête

### 3.1 Exemple : « Créer une entreprise » (`POST /api/v1/companies`)
1. **Navigateur** → Next.js relaie `/api/*` vers l'API (même origine, pas de CORS).
2. **Gardes globales** (`platform/`) : limitation de débit (`app-throttler.guard.ts`), contrôle d'origine anti-CSRF (`origin.guard.ts`).
3. **`@Protected('bd.company.create')`** (`iam/presentation/protected.decorator.ts`) enchaîne :
   `AccessTokenGuard` (jeton valide, session active) → `RequireMfaGuard` (second facteur vérifié) → `PermissionGuard` (permission lue **en base**, pas dans le jeton).
4. **Contrôleur** (`companies.controller.ts`) : valide le corps (`RegisterCompanyDto` : tout champ inconnu est refusé) et injecte le **propriétaire = l'utilisateur connecté** (jamais lu dans le corps).
5. **Cas d'usage** (`register-company.use-case.ts`) : ouvre une transaction, refuse un doublon, crée l'entreprise **et** l'entrée d'audit dans la même transaction.
6. **Domaine** (`company.ts`, `company-name.ts`) : règles du nom et de l'état.
7. **Infrastructure** (`prisma-company.repository.ts`) : écrit en base.
8. **Réponse** : représentation publique (`company-view.ts`) ; erreurs au format `application/problem+json`.

### 3.2 Exemple : « Mot de passe oublié »
`/login` → lien « Mot de passe oublié ? » → `app/forgot-password/page.tsx` → `POST /auth/password-reset/request` (`auth.controller.ts`, publique, limitée à 3/min) → **réponse immédiate identique** → en arrière-plan `RequestPasswordResetUseCase` (`password-reset.use-cases.ts`) : verrou du compte, plafond 3/heure, révocation des anciens liens, création du lien (empreinte SHA-256 seule en base), **audit** `PASSWORD_RESET`, envoi de l'e-mail.
L'utilisateur ouvre le lien → `app/reset-password/page.tsx` (jeton lu dans le fragment `#`, effacé de l'adresse) → `POST /auth/password-reset/accept` → `ResetPasswordUseCase` : validation du lien et de la politique, consommation **atomique**, changement du mot de passe, **toutes les sessions coupées**, audit, e-mail de confirmation. Le **MFA reste exigé** à la connexion suivante.

## 4. Conventions

| Sujet | Règle |
|---|---|
| Langue | Code en anglais (noms techniques), **commentaires et libellés en français** |
| Commentaires | Chaque classe, fonction, méthode publique, interface et composant porte un commentaire `/** … */` qui dit **ce que ça fait et pourquoi** (pas comment, le code le dit). Un script en tire l'index des fonctions : `node scripts/gen-function-index.mjs` |
| Erreurs | Le domaine lève des erreurs typées (`DomainError`) ; la présentation les traduit en HTTP (400, 401, 403, 404, 409, 422) |
| Temps et identifiants | Toujours injectés (`Clock`, `IdGenerator`) pour des tests déterministes |
| Secrets | Jamais dans le code ni dans les journaux ; `.env` ignoré par Git, `.env.example` seul versionné |
| Audit | Toute action sensible écrit dans le journal **dans la même transaction** ; le journal est en ajout seul (la base refuse `UPDATE` et `DELETE`) |
| Dette | Tout raccourci est inscrit dans `docs/TECH-DEBT.md` avec un propriétaire |
| Branches | `sprint/<nom>` depuis `main`, jamais de commit direct sur `main` ; fusion `--no-ff` et tag `sN-validated` après validation explicite |

## 5. Où sont les tests, et que prouvent-ils ?

| Type | Où | Lancer | Ce qu'ils prouvent |
|---|---|---|---|
| Unitaires (API) | `src/**/*.spec.ts`, `test/*.spec.ts` | `pnpm test` | Règles métier et cas d'usage, sur des faux en mémoire (rapides) |
| Intégration (API + base) | `test/*.integration.spec.ts` | `node apps/crm-api/scripts/test-db.mjs` | Parcours HTTP réels sur PostgreSQL jetable : droits, courses, audit, migrations |
| Matrice de droits | `test/rbac-http.integration.spec.ts` | idem | Chaque rôle × chaque route : autorisé exactement là où la matrice le prévoit |
| Protection des routes | `test/route-protection.spec.ts` | `pnpm test` | **Aucune route ne peut être ouverte par oubli** (test qui parcourt toutes les routes montées) |
| Migration | `scripts/check-upgrade.mjs` | `pnpm --filter @investally/crm-api check:upgrade` | Une migration préserve les données existantes |
| Interface | `apps/crm-web/test/*.test.ts` | `pnpm test` | Client HTTP (rafraîchissement, MFA, anti-rejeu), parseurs, droits |
| Architecture | `.dependency-cruiser.cjs` | `pnpm arch` | Les couches ne se contournent pas |

La base de test est **jetable** (PostgreSQL embarqué, mot de passe aléatoire) : elle n'est jamais votre vraie base.

## 6. Recettes du développeur

### Ajouter une route protégée
1. Choisir (ou ajouter) une permission dans `iam/domain/permission-catalog.ts` ; l'attribuer aux rôles dans `iam/domain/roles.ts` ; régénérer `docs/RBAC.md` (`pnpm --filter @investally/crm-api docs:rbac`).
2. Dans le contrôleur : `@Protected('module.ressource.action')` (ajouter `{ stepUp: true }` si l'action est sensible, `{ minScope: 'ALL' }` si elle agit sur n'importe quel utilisateur).
3. Dans le cas d'usage : appliquer la **portée** objet par objet (`decideFor`, `visibilityFor`) ; un objet hors portée est **introuvable (404)**.
4. Écrire le test ; `test/route-protection.spec.ts` échoue tant que la route n'est pas protégée ou déclarée publique.

### Ajouter un module métier
Créer `modules/<nom>/{domain,application,infrastructure,presentation}`, exposer **uniquement** `index.ts` et le fichier `*.module.ts` (les autres modules n'importent rien d'autre), enregistrer le module dans `app.module.ts`, lancer `pnpm arch`.

### Ajouter une migration
Modifier `prisma/schema.prisma`, créer le SQL dans `prisma/migrations/<date>_<nom>/migration.sql` (avec les contraintes que Prisma ne sait pas exprimer : `CHECK`, index partiels), tester avec `check:upgrade`.

## 7. Lexique

| Terme | Signification |
|---|---|
| **Portée** | Étendue d'un droit : *Propre* (mes objets), *Équipe* (moi + mes subordonnés directs), *Tous* |
| **Step-up** | Nouvelle preuve du second facteur (moins de 10 minutes) exigée pour une action sensible |
| **Amr** | Méthodes d'authentification inscrites dans le jeton : `pwd` (mot de passe), `otp` (second facteur) |
| **Famille de jetons** | Tous les jetons de rafraîchissement issus d'une même connexion ; un rejeu coupe la famille |
| **IDOR** | Accès à l'objet d'un autre en changeant un identifiant ; contré par le « 404 hors portée » |
| **Lien à usage unique** | Jeton 256 bits dont seule l'empreinte SHA-256 est stockée ; sert à l'invitation et à la réinitialisation |
| **Agrément** | Promesse de paiement d'une formation par le client (métier Investudy, S4.4) |
