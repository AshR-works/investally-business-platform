# Guide pratique : exécuter Investally en local

*Pile : interface Next.js (3000) → API NestJS (3001) → PostgreSQL embarqué (54330). Tout sur `127.0.0.1`, sans Docker. Stratégie et justification : `docs/EXECUTION-LOCALE.md`.*

## Démarrer
```bash
cd C:\dev\investally\investally-platform
git checkout main && git pull             # la branche d'exécution locale est fusionnée
pnpm install                              # une seule fois, puis après chaque mise à jour des dépendances
node scripts/local-stack.mjs --demo --rebuild   # ou : pnpm local --demo --rebuild
```
`--rebuild` est nécessaire après chaque mise à jour du code : il recompile l'API et l'interface, et les nouvelles migrations sont appliquées au démarrage.
Prérequis : Node 22 LTS, pnpm 12, une application TOTP (téléphone ou extension navigateur).

## Ce que fait la commande
1. Génère les secrets locaux (une fois) dans `C:\dev\investally\investally-local\secrets.json`.
2. Compile l'API et l'interface (long la première fois seulement).
3. Démarre PostgreSQL (données dans `..\investally-local\pgdata`), applique les migrations, crée rôles et permissions.
4. Crée `admin@investally.test` si aucun utilisateur n'existe : mot de passe aléatoire **affiché une seule fois**.
5. Avec `--demo` : un compte par rôle, puis le **jeu de données de démonstration** : 40 entreprises fictives (banques, fintechs, assurances, gestion de patrimoine, bourse, télécoms, industries, PME) réparties entre `compte1`, `compte2` et `compte3`, avec leur vie commerciale sur douze mois : contacts, facilitateurs et commissions, offres, décharges, relances (faites, à venir, en retard), rendez-vous (tenus, annulés, à venir), opportunités à toutes les étapes (perdues, gagnées, dérogations), agréments (demandé, reçu, honoré, expiré, annulé, payeur tiers) et ambassadeurs. Les données sont **entièrement fictives** et passent par les vrais cas d'usage ; le chargement est **rejouable sans doublon** (commande seule : `node apps/crm-api/dist/src/cli/seed-demo.js` après la compilation).
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
| Chargés de compte (3) | `compte1@`, `compte2@`, `compte3@` (responsable : `commercial@`) |
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
node apps/crm-api/scripts/test-db.mjs     # intégration, base jetable (TEST_DB_PORT=54340 si le port 54329 est occupé)
```

## Scénarios à parcourir
1. Premier administrateur : connexion, enrôlement MFA, déconnexion, reconnexion.
2. Invitation d'un collaborateur (lien dans `api.log`), activation, droits selon le rôle.
3. Entreprises : liste ; `compte1` ne voit que les siennes, `compte2` les autres.
4. Contacts et offres : ajouter un contact à une entreprise de `compte1`, créer une offre, la déposer, enregistrer la décharge signée (PDF, PNG ou JPG), puis accepter, refuser ou retirer l'offre (motif obligatoire pour le retrait).
5. Relances : depuis le menu d'une offre déposée, planifier une relance (jamais dans le passé, trois au plus par offre), la terminer avec un résultat ; retirer l'offre annule les relances à faire.
6. Agenda : « Planifier un rendez-vous » depuis une offre ou une fiche d'entreprise ; planifier deux rendez-vous qui se chevauchent (un avertissement s'affiche, sans blocage) ; essayer les vues Jour, Semaine et Mois ; reporter, marquer tenu (une fois l'heure venue) et annuler, en laissant le texte obligatoire vide pour voir le refus.
7. Documents d'une entreprise ou d'une offre : envoi, nouvelle version, téléchargement, archivage.
8. Sessions actives : historique et révocation des autres sessions.
9. Opportunités : « Nouvelle opportunité » depuis la fiche d'une entreprise ; faire avancer d'étape en étape ; essayer l'accord de principe sans rendez-vous décideur tenu (refus, puis dérogation du Responsable commercial avec justification) ; clore perdue (motif obligatoire) ou gagnée (Responsable commercial).
10. Statut et responsable d'une entreprise : sur la fiche, marquer « contactée » puis « qualifier » (refus sans contact) ; en Responsable commercial, « Changer de responsable » (équipe seulement, confirmation) ; observer les colonnes « Responsable » et « Valeur » du tableau des entreprises.
11. Agrément : sur une opportunité à l'accord de principe, « Enregistrer un agrément » depuis la fiche (montant et/ou places, document signé) ; l'entreprise devient « Cliente » ; déclarer expiré ou annuler (motif) en Responsable commercial ; **honorer (constater le paiement) en Finance** ; case « La promesse n'est pas encore signée » pour un agrément seulement demandé (puis « Déclarer reçu »), payeur tiers facultatif ; la réattribution d'une entreprise redemande un code si le dernier a plus de 10 minutes.
12. Portée et droits : `compte2` ne voit rien de `compte1`, `commercial@` voit son équipe, `direction@` lit sans écrire ; tout accès hors périmètre répond « introuvable ».

## Limites connues
- Modules livrés : identité et accès, entreprises (statuts, responsable, fiche 360°), contacts, offres, décharges signées, relances, agenda (rendez-vous et visites), opportunités, agréments (demandé, reçu, honoré par la Finance, payeur tiers), ambassadeurs, commissions des facilitateurs à verser (déblocage par la Finance, versement avec justificatif), documents. Le module commercial est complet ; Investudy, le pilotage et les stocks arrivent ensuite.
- La démonstration (`--demo`) charge un jeu complet pour tout le module commercial (voir l'étape 5). **Investudy, la finance et le reporting n'ont pas de données : ces modules n'existent pas encore** (leur jeu est spécifié dans `docs/cadrages/OBSERVATIONS-VALIDATION-UX-ET-DONNEES-DE-TEST.md`). Aucun document, contrat, attestation, facture ni fichier joint n'est généré.
- Rappels de rendez-vous : aucun envoi (ni e-mail ni notification) ; synchronisation Outlook absente.
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

