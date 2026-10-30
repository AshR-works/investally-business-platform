# Guide pratique : exécuter Investally en local

*Pile : interface Next.js (3000) → API NestJS (3001) → PostgreSQL embarqué (54330). Tout sur `127.0.0.1`, sans Docker. Stratégie et justification : `docs/EXECUTION-LOCALE.md`.*

## Démarrer
```bash
cd C:\dev\investally-platform
git checkout sprint/execution-locale      # jusqu'à la fusion dans main
pnpm install                              # une seule fois
node scripts/local-stack.mjs --demo       # ou : pnpm local --demo
```
Prérequis : Node 22 LTS, pnpm 12, une application TOTP (téléphone ou extension navigateur).

## Ce que fait la commande
1. Génère les secrets locaux (une fois) dans `C:\dev\investally-local\secrets.json`.
2. Compile l'API et l'interface (long la première fois seulement).
3. Démarre PostgreSQL (données dans `..\investally-local\pgdata`), applique les migrations, crée rôles et permissions.
4. Crée `admin@investally.test` si aucun utilisateur n'existe : mot de passe aléatoire **affiché une seule fois**.
5. Avec `--demo` : 40 entreprises fictives (20 pour `compte1`, 20 pour `compte2`) et un compte par rôle.
6. Démarre l'API puis l'interface et affiche les adresses.

## Utiliser
- Interface : `http://127.0.0.1:3000` · API (Swagger) : `http://127.0.0.1:3001/api/docs`.
- Première connexion de **chaque** compte : scanner le QR code avec l'application TOTP (MFA obligatoire).
- Changer de rôle : se déconnecter, se reconnecter avec un autre compte.
- E-mails : aucun n'est envoyé ; les liens d'invitation et de réinitialisation sont dans `..\investally-local\logs\api.log`.

## Comptes de démonstration (domaine `demo.investally.test`)
| Rôle | Adresse |
|---|---|
| Super administrateur | `admin@investally.test` |
| Direction | `direction@` |
| Responsable commercial | `commercial@` |
| Chargés de compte (2) | `compte1@`, `compte2@` (responsable : `commercial@`) |
| Responsable Investudy | `investudy@` |
| Formateur | `formateur@` (responsable : `investudy@`) |
| Support, Finance, RH, Fiscalité | `support@`, `finance@`, `rh@`, `fiscalite@` |

Mots de passe : `..\investally-local\demo-accounts.json` (local, hors dépôt, aléatoires, interdits en production).

## Commandes courantes
| Action | Commande |
|---|---|
| Arrêter (données conservées) | `Ctrl+C` dans la console |
| Relancer | même commande (rapide, sans doublon) |
| Recompiler après mise à jour du code | ajouter `--rebuild` |
| Interface en mode développement | ajouter `--dev` (non testé) |
| Tout effacer | `node scripts/local-stack.mjs reset` (taper OUI) |
| Autre dossier de données | variable `INVESTALLY_LOCAL_HOME` |
| Autres ports | `LOCAL_DB_PORT`, `LOCAL_API_PORT`, `LOCAL_WEB_PORT` |

## Valider la qualité sans la pile
```bash
pnpm ci                                   # types, architecture, tests unitaires
node apps/crm-api/scripts/test-db.mjs     # intégration, base jetable
```

## Scénarios à parcourir
1. Premier administrateur : connexion, enrôlement MFA, déconnexion, reconnexion.
2. Invitation d'un collaborateur (lien dans `api.log`), activation, droits selon le rôle.
3. Entreprises : liste ; `compte1` ne voit que les siennes, `compte2` les autres.
4. Documents d'une entreprise : envoi, nouvelle version, téléchargement, archivage.
5. Sessions actives : historique et révocation des autres sessions.
6. Refus d'accès hors périmètre : toujours « introuvable ».

## Limites connues
- Modules livrés : identité et accès, entreprises, documents. Le reste arrive avec S4 à S6.
- Non testé : enrôlement MFA dans un navigateur, `--dev`. Node 22 : testé le 2026-10-29 (183 tests d'intégration et 159 tests de l'interface réussis, voir « Node 22 » ci-dessous).
- Docker : prévu en S7 (voir la stratégie).

## Node 22 (sans toucher aux autres projets)
Le projet vise **Node 22 LTS** (`.nvmrc`, intégration continue). Si votre machine a une autre version (l'application affiche alors un avertissement), installez **fnm**, un gestionnaire de versions qui garde plusieurs Node côte à côte :

```bash
winget install --id Schniz.fnm -e
```

Rouvrez ensuite le terminal, puis :

```bash
fnm install 22
```

Lancer l'application avec Node 22, depuis la racine du dépôt (sans rien modifier d'autre) :

```bash
fnm exec --using=22 node scripts/local-stack.mjs
```

Les dépendances déjà installées restent valables (aucune réinstallation). Les autres projets continuent d'utiliser votre Node habituel : la version 22 ne s'applique qu'à la commande ci-dessus. Pour changer de version dans tout un terminal : `fnm use 22` (lit `.nvmrc`).

**Vérifié le 2026-10-29** sous Node 22.23 : 183 tests d'intégration (base PostgreSQL réelle, hachage des mots de passe compris) et 159 tests de l'interface réussis.

