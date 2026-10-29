# CLAUDE.md : Investally Business Platform

> Complète `C:\dev\CLAUDE.md` et **prime** en cas de conflit. Dernière révision : 2026-10-22. *(Exemple produit avec le modèle `templates/CLAUDE.project.md` ; Investally n'avait pas encore de CLAUDE.md : ses règles vivaient dans la mémoire des chats.)*

## À lire impérativement avant toute modification
1. `docs/livrables/05-ETAT-D-AVANCEMENT.md` et `04-SUIVI-DES-SESSIONS.md` (état réel, sessions validées).
2. `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/RBAC.md`, `docs/DATA-MODEL.md`, `docs/TECH-DEBT.md`.
3. `docs/QUESTIONS-ET-DECISIONS.md` (décisions prises et questions ouvertes) et `docs/METHODE-D-ARBITRAGE.md`.
4. `docs/design/README.md` et `docs/design/exigences/REGISTRE-EXD.md` (exigences de conception EXD obligatoires).
5. Le dernier rapport de `docs/daily-reports/` et le guide `docs/GUIDE-EXECUTION-LOCALE.md`.

## Présentation
Plateforme propriétaire d'Investally : **CRM** (Business Development + centre de formation Investudy), puis **ERP** (stocks, reporting, RH, finance, fiscalité). Pays : Cameroun. Langue de travail : **français**.
- **Périmètre de ce chat** : Investally uniquement. KwataBall (`C:\dev\kwataball`) est un projet distinct, avec son propre chat : ne pas le lire ni le modifier ici. Les enseignements transversaux passent par les standards et Skills partagés (`C:\dev\CLAUDE.md`, `C:\dev\skills`).
- Dépôt : `https://github.com/AshR-works/investally-business-platform` (**public** : aucun secret, aucun e-mail, aucun détail exploitable d'une faille). Responsable produit : l'utilisateur (« Je valide X » = fusion).

## Vision
Un seul système, sécurisé et audité, pour piloter l'activité commerciale, la formation puis les opérations de l'entreprise. Détail : `docs/VISION.md`.
- **Hors périmètre actuel** : modules ERP (S7 et après), antivirus (bloquant pour la production), Microsoft 365 réel.

## Stack
| Couche | Choix | Contrainte |
|---|---|---|
| Monorepo | pnpm 12 | `pnpm install --frozen-lockfile` ; scripts d'installation à déclarer dans `allowBuilds` |
| API | NestJS 11 (CommonJS), Prisma 7 multiSchema (`bd`, `audit`, `iam`, `docs`) | Node **22** (`.nvmrc`) |
| Base | PostgreSQL 17 | tests : base **jetable** (`apps/crm-api/scripts/test-db.mjs`) |
| Web | Next.js 16.4.2, React 19, Tailwind CSS 4.3.3 (figé) | jetons copiés du design, test d'identité |
| Tests | Jest (API), Vitest (web), dependency-cruiser, axe-core via `scripts/a11y-audit.mjs` | `pnpm ci` = types + architecture + tests |

## Architecture
Monolithe modulaire, Clean Architecture ; règles testées par `pnpm arch` (domaine pur, application sans persistance ni HTTP, présentation sans persistance, ORM confiné, frontière de module, pas de cycle). Contrat anti-IDOR : `test/support/idor-registry.ts`.

## Modules (état au 2026-10-22)
| Module | Rôle | État |
|---|---|---|
| `iam` | connexion, MFA, rôles (10), permissions (99), sessions, invitations | livré (S3.1–S3.5, H2) |
| `audit` | journal transactionnel, historique des connexions | livré |
| `business-development` | entreprises, coordonnées, facilitateurs et commissions | livré (S1, S4.0) ; contacts, offres, opportunités : S4.1+ |
| `documents` | pièces jointes versionnées, stockage derrière un port | livré (S3.6) |
| Investudy, Stocks, Reporting, ERP | | à venir (S5, S6, S7) |

## Décisions techniques structurantes
ADR-0001 monolithe modulaire · 0002 Prisma confiné à l'infrastructure · 0003 domaine distinct de la persistance · 0004 stratégie d'audit · 0005 CRM séparé de l'ERP · 0006 accès et sécurité · 0007 Stocks autonome hébergé · 0008 stockage des documents derrière un port. Liste complète : `docs/adr/`.

## Dossiers importants
`apps/crm-api/` (API) · `apps/crm-web/` (interface) · `docs/` (documentation, `cadrages/`, `design/`, `accessibilite/`, `daily-reports/`, `livrables/`) · `scripts/` (audit d'accessibilité, lancement local, rapports journaliers, conversion HTML).

## Roadmap et backlog (résumé)
Ordre décidé (DEC-005) : **cadrage UX (5 écrans)** → S4.1 à S4.4 (+ agenda) → S5 → S6 (reporting) → Stocks → S7 (production). Source : `docs/livrables/05-ETAT-D-AVANCEMENT.md`.

## Standards spécifiques
- **Branches** : `main` + `sprint/<code>-<sujet>` ; **jamais de commit direct sur `main`**. Fusion `--no-ff` et étiquette `<session>-validated` **seulement après « Je valide X »**.
- **Avant de demander une validation** : tests et recette exécutés, `docs/QUESTIONS-ET-DECISIONS.md` et `docs/TECH-DEBT.md` à jour.
- **Décisions structurantes** : méthode d'arbitrage (options, grille pondérée, recommandation) ; ne jamais décider à la place de l'utilisateur.
- **Design** : toute modification du design met à jour `docs/design/` (changelog, version, registre EXD, DDR, captures, prototype) dans le même lot.
- **Règles de fer** : ne jamais coller ni copier dans ce dépôt du contenu d'un autre projet (leçon du 2026-10-22 : un prompt d'un autre projet avait écrasé `docs/design/releases/index.json`, restauré depuis Git) ; base **jetable** uniquement, jamais la vraie ; pas de mot de passe administrateur par défaut ; l'API n'écoute que sur `127.0.0.1` ; ne jamais tester le service Microsoft 365 réel ; ne jamais supprimer l'ancienne copie OneDrive sans accord ; ne pas utiliser les maquettes PDF tierces de `C:\dev\external ressources` sans demande.
- **Commandes** : installer `pnpm install --frozen-lockfile` · qualité `pnpm ci` · intégration `node apps/crm-api/scripts/test-db.mjs` · lancer en local `node scripts/local-stack.mjs --demo` · clôturer la journée `pnpm report:close`.
- **Pièges connus** : Node 26 local alors que le projet vise Node 22 ; pnpm 12 refuse les scripts d'installation non déclarés (CI Linux) ; les réécritures Next.js sont figées à la compilation (recompiler si le port de l'API change) ; `scripts/test-db.mjs` doit sortir en erreur si un test échoue.

## Priorités actuelles
1. Valider **S3.7** (mot de passe affichable, confirmation, codes de secours à affichage unique) puis lot **UX-02** (rôles par groupes + aperçu des droits).
2. **Cadrage UX** : l'utilisateur doit choisir les 5 écrans clés avant S4.1.
3. Compléter la protection de `main` (vérification `verify` obligatoire) et poursuivre les rapports journaliers.
**Décisions qui attendent l'utilisateur** : 5 écrans du cadrage UX · défauts des documents (D22/D45) · avis juridique · deux Super administrateurs nommés · écoute avec un lecteur d'écran réel (D31).
