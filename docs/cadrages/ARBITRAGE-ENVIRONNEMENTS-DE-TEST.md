# Arbitrage — Les environnements locaux de test : cinq dossiers séparés, ou un seul à seeds nommés ?

*2026-11-14. Déclenché par une question de la Direction produit (« pourquoi on pointe sur des dossiers annexes lors des tests ? ») pendant la préparation des tests manuels de l'API. Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md).*

## 1. Contexte

En marge du dépôt, cinq dossiers portent chacun une pile locale complète (base PostgreSQL embarquée, secrets, comptes) :

| Dossier | Port API / base | Contenu | Pourquoi il est né |
|---|---|---|---|
| `investally-local` | 3001 / 54330 | Pile habituelle avec interface, jeu de démonstration fictif complet, compte `tests-api@investally.test` | L'environnement de travail quotidien (`local-stack.mjs --demo`) |
| `investally-local-api-backend` | 3031 / 54370 | API seule (sans interface), organisation réelle d'Investally, Super administrateur `h.bebey@investally.test` | Tester les appels d'API sans dépendre de l'interface, sur une base qui ne mélange pas essais et démonstration |
| `investally-local-api-tests` | — | Jeu de démonstration, admin enrôlé | Un premier essai de pile dédiée aux tests d'API, antérieur au précédent |
| `investally-local-demo-dg` | — | Organisation réelle, catalogue réel, personas liés aux fiches des employés | Présenter l'outil au Directeur général sans données fictives ni essais en cours |
| `investally-local-v1-prod` | — / 54350 | Base seule, les 31 migrations immutables de la V1, aucune donnée métier | Reproduire la base de production avant son premier déploiement |

Chaque dossier est **hors du dépôt et hors OneDrive**, pour deux raisons distinctes qu'il ne faut pas confondre :
1. **Les secrets ne doivent jamais entrer dans le dépôt** (mots de passe, secrets TOTP, codes de secours) — non négociable.
2. **Une base PostgreSQL embarquée ne supporte pas d'être synchronisée en continu par OneDrive** (fichiers binaires, écritures fréquentes, verrous) — c'est pour ça que `local-stack.mjs` place par défaut son dossier de données *hors* OneDrive. Vérification faite le 2026-11-14 : le dépôt de travail (`C:\dev\investally\investally-platform`) et tous les dossiers annexes sont déjà sous `C:\dev`, en dehors de `C:\Users\Lenovo\OneDrive`. **Ce risque n'existe donc pas aujourd'hui**, quel que soit le nombre de dossiers.

La vraie question n'est pas « faut-il sortir les données du dépôt et de OneDrive » (déjà réglé, et non contesté), mais **« faut-il cinq piles séparées, ou une seule »**.

**Contrainte posée par la Direction produit avant cet arbitrage** : *aucun besoin constaté d'avoir deux de ces environnements vivants (en train de tourner) en même temps.* Cette contrainte élimine d'emblée l'argument qui aurait pu justifier la multiplication des dossiers.

## 2. Options

### A — Statu quo : cinq dossiers séparés, chacun sa pile

Chaque usage garde son dossier, ses scripts (`lancer-*.cmd`), ses secrets et sa base dédiée.

- **Avantages** : chaque dossier est déjà prêt, isolé par construction (aucun risque de confondre la Démo DG avec un essai) ; rien à changer, aucun risque de régression.
- **Inconvénients** : cinq jeux de secrets à ne jamais confondre (mot de passe, secret TOTP, codes de secours) ; cinq README à tenir à jour ; chaque nouveau besoin ponctuel (« je veux tester juste le backend ») a tendance à faire naître un sixième dossier, comme c'est déjà arrivé deux fois (`-api-backend` après `-api-tests`) ; aucun moyen de passer d'un contexte à l'autre autrement qu'en changeant de dossier et de port, ce qui demande de se souvenir lequel correspond à quel usage.
- **Impacts** : aucun (ne change rien à l'existant).
- **Réversibilité** : 🟢 sans objet (c'est l'état actuel).

### B — Un seul environnement local, à seeds nommés

Une seule pile (un seul dossier annexe, un seul jeu de ports), pilotée par `local-stack.mjs`, à laquelle on donne le **seed** (jeu de données) voulu au démarrage. Passer d'un seed à l'autre se fait par une remise à zéro explicite (`local-stack.mjs reset`, déjà existant) suivie du lancement avec le seed voulu.

Catalogue de seeds proposé, reprenant un à un les usages des cinq dossiers actuels :
| Seed | Remplace | Contenu |
|---|---|---|
| *(aucun, par défaut)* | — | Base migrée, rôles et permissions, aucune donnée métier, aucun compte (sauf le premier administrateur créé à la demande) |
| `demo` | `investally-local` | Jeu de démonstration fictif complet, un compte par rôle *(déjà implémenté par le drapeau `--demo`)* |
| `organisation` | `investally-local-api-backend`, en partie `investally-local-demo-dg` | Les 10 fiches réelles du personnel et leur hiérarchie, Super administrateur `h.bebey@investally.test` |
| `organisation-complete` | `investally-local-demo-dg` | `organisation` + vrai catalogue de formation + comptes des personas liés aux fiches |
| `api-seule` | `investally-local-api-backend` | N'importe lequel des seeds ci-dessus, **sans démarrer l'interface** (équivaut à l'actuel `lancer-api-seule.mjs`, à fusionner dans `local-stack.mjs` comme un nouveau drapeau `--sans-interface`, indépendant du seed choisi) |
| `v1-baseline` | `investally-local-v1-prod` | *(déjà implémenté par le drapeau `--db-only`)* |

- **Avantages** : un seul jeu de secrets, un seul README à jour, un seul port à retenir ; retrouver un état propre est une commande (`reset` + seed) au lieu de se souvenir de quel dossier ouvrir ; les nouveaux besoins ponctuels s'ajoutent au catalogue de seeds plutôt que de faire naître un nouveau dossier.
- **Inconvénients** : il faut écrire le sélecteur de seed dans `local-stack.mjs` et migrer les scripts existants ; **il devient possible d'oublier de changer de seed avant un usage sensible** (notamment avant de recevoir le Directeur général) — risque nouveau, qui n'existait pas avec des dossiers physiquement séparés.
- **Impacts** : code (`local-stack.mjs`, scripts de seed), aucun impact sur le modèle de données ni la sécurité de l'application elle-même.
- **Réversibilité** : 🟢 facile — les scripts des cinq dossiers actuels ne seraient supprimés qu'une fois B éprouvé ; revenir en arrière consiste à les rouvrir.

### C — Un conteneur Docker par profil (steelman, écartée)

Chaque usage devient un service `docker-compose`, isolé par profil, lancé à la demande.

- **Avantages** : isolation aussi forte que l'option A, sans dossiers séparés à la main ; rapprocherait l'exécution locale de l'hébergement de production, qui utilise Docker Compose (décision D63) — c'est le seul angle où C dépasse B.
- **Inconvénients** : contredit la stratégie d'exécution locale déjà actée (« Pile LOCALE PERSISTANTE de l'application, **sans Docker** et sans Claude Code », en-tête de `local-stack.mjs` ; `docs/EXECUTION-LOCALE.md`) ; ajoute Docker comme dépendance locale alors que le projet s'en passe justement pour la machine de développement ; plus lourd à écrire que B pour un gain qui ne répond à aucun besoin exprimé aujourd'hui.
- **Impacts** : le plus large des trois (nouvelle dépendance, fichiers `compose` à écrire et maintenir, image à construire).
- **Réversibilité** : 🟡 moyenne (dépendance ajoutée puis retirée).

## 3. Grille pondérée

| Critère | Poids | A — statu quo | B — un environnement, seeds nommés | C — Docker par profil |
|---|---|---|---|---|
| Coût de maintenance (secrets et README à tenir à jour) | 4 | 2 → 8 | 5 → 20 | 3 → 12 |
| Risque de fuite de secrets (copies multiples) | 5 | 2 → 10 | 5 → 25 | 4 → 20 |
| Isolation des données sensibles (Démo DG à l'abri d'un essai) | 4 | 4 → 16 | 3 → 12 | 4 → 16 |
| Rapidité pour retrouver un état propre entre deux essais | 3 | 3 → 9 | 4 → 12 | 3 → 9 |
| Coût de migration depuis l'existant | 2 | 5 → 10 | 2 → 4 | 1 → 2 |
| **Total (maximum 90)** | | **53** | **73** | **59** |

B l'emporte nettement. Le seul critère où A et C la devancent est l'isolation « physique » par séparation des dossiers — compensée par une règle de discipline (§4) plutôt que par la structure elle-même.

## 4. Risques et dette de l'option recommandée (B)

- **Dette à créer** : écrire le sélecteur de seed dans `local-stack.mjs` (drapeau `--seed=<nom>`, indépendant du drapeau `--demo` actuel qui en devient un cas particulier) ; écrire les seeds `organisation` et `organisation-complete` à partir des scripts déjà écrits pour la Démo DG (`charger-demo-dg.cjs`, `creer-personas.cjs`) ; migrer le compte et les secrets de `investally-local-api-backend` vers l'environnement unique ; retirer ensuite les quatre dossiers devenus inutiles (`-api-backend`, `-api-tests`, `-demo-dg` une fois son usage couvert par un seed, `-v1-prod` déjà couvert par `--db-only`).
- **Risque opérationnel nouveau** : oublier de changer de seed avant un usage sensible — en particulier, démarrer l'environnement pour un essai technique alors que le seed `organisation-complete` (celui montré au Directeur général) est encore chargé, ou l'inverse. **Garde-fou proposé** : le message de démarrage de `local-stack.mjs` affiche toujours le seed actif en évidence ; avant toute démonstration, la discipline reste « `reset` puis relancer avec le bon seed », jamais réutiliser un environnement déjà en l'état.
- **Non couvert par cet arbitrage** : le choix de ne pas utiliser Docker en local (option C écartée) ne remet pas en cause la décision D63 (Docker Compose en **production**) — les deux questions sont indépendantes.

## 5. Recommandation

**Option B**, un seul environnement local à seeds nommés. La grille et le constat de la Direction produit (jamais eu besoin de deux environnements vivants en même temps) convergent : la séparation en cinq dossiers n'achetait aucune capacité réellement utilisée, au prix d'une maintenance et d'un risque de secrets inutilement multipliés.

## 6. Décision

**Décidé** (2026-11-14, Direction produit, dans l'échange qui a ouvert cet arbitrage) : **option B — un seul environnement local, à seeds nommés**, remplaçant à terme les cinq dossiers annexes.

**Implémenté et vérifié le 2026-11-14** : `scripts/local-stack.mjs` porte désormais `--seed=demo|organisation|organisation-complete` et `--sans-interface`, testés dans un dossier et des ports jetables (sans toucher à l'environnement habituel ni à la Démo DG en préparation) :
- `--seed=organisation` : administrateur `h.bebey@investally.test` créé et **lié à la fiche** de Henri Bebey, 10 employés, 0 entreprise, 0 catalogue — conforme.
- `--seed=organisation-complete` : + catalogue réel (programme, modules, certificats, salles) et les 4 comptes personas liés à leur fiche — conforme.
- `--demo` (alias) et `--db-only` : toujours intacts (régression vérifiée).
- Détail de la méthode et de l'usage courant : [METHODE-DE-TESTS-API §2](../api/METHODE-DE-TESTS-API.md#2-lenvironnement-local).

**Reste à faire, volontairement non engagé** : les quatre dossiers annexes devenus redondants (`investally-local-api-backend`, `investally-local-api-tests`, les scripts de lancement propres à `investally-local-demo-dg`, `investally-local-v1-prod`) **n'ont pas été supprimés**. `investally-local-demo-dg` garde en particulier son rôle de porte-données (`employes-reels.json`, lu par défaut via `ORGANISATION_DATA_DIR`) et ne doit pas être touché avant la présentation au Directeur général. Leur retrait est un nettoyage séparé, à faire quand la Direction produit le demande.
