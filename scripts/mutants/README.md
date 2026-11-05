# Tests de mutation

Un **mutant** est une faute injectée volontairement dans le code (une condition neutralisée, un droit remplacé par un autre, une contrainte de base retirée…). On relance ensuite les tests : un mutant doit être **tué** (au moins un test échoue). Un mutant qui **survit** révèle un test trop faible, à renforcer.

Chaque lot du module commercial a son script. Les résultats (nombre de mutants tués) figurent dans la recette du lot (`docs/SPRINT-*-RECETTE.md`) et dans le journal `docs/TESTING.md`.

## Les scripts

| Script | Lot | Objet |
|---|---|---|
| `s40-facilitateurs.py` | S4.0 | facilitateurs et commission |
| `s40c-modifier-exporter.py` | S4.0c | modifier et exporter une fiche d'entreprise |
| `s41a-contacts.py` | S4.1a | contacts |
| `s41b-tableau-entreprises.py` | S4.1b | tableau des entreprises |
| `s42a-offres.py` | S4.2a | offres |
| `s42b-decharges.py` | S4.2b | décharges signées |
| `s42c-relances.py` | S4.2c | relances |
| `s42d-agenda.py` | S4.2d | agenda |
| `s43a-opportunites.py` | S4.3a | opportunités |
| `s43b-statuts-responsable.py` | S4.3b | statuts d'entreprise et responsable |
| `s43c-valeur-lien-rdv.py` | S4.3c | valeur des opportunités et lien rendez-vous |
| `s44a-agrements.py` | S4.4a | agréments |
| `s44c-commissions.py` | S4.4c | commissions à verser |
| `s44b-ambassadeurs.py` | S4.4b | ambassadeurs |
| `s44abis-correctifs-agrements.py` | S4.4a-bis | agrément demandé, payeur tiers, constat par la Finance, second facteur |
| `correctifs-recette-1.py` | Correctifs 1 | téléphones, fenêtres, barres de défilement, tableaux |
| `documents.py` | S3.x | module Documents |
| `roles-ux.py` | S3.8 | sélecteur de rôles |
| `rapport-journalier.py` | hors lot | rapport journalier |

## Lancer

Depuis la racine du dépôt (Windows, Python 3) :

```bash
python scripts/mutants/s43c-valeur-lien-rdv.py          # tous les mutants du lot
python scripts/mutants/s43c-valeur-lien-rdv.py P1 P11   # seulement ceux-là (identifiants P1, P11…)
```

Chaque mutant s'affiche `TUÉ`, `SURVIVANT` ou `INCONCLUANT` ; la dernière ligne donne le `BILAN`. Un mutant `INCONCLUANT` signifie que la série de tests n'a pas rendu de résultat exploitable (à relancer).

## Précautions

- **Ces scripts modifient temporairement le code source**, puis le restaurent à l'identique (même en cas d'échec). Lancez-les sur un **arbre de travail propre** (`git status` vide) et **ne touchez à rien pendant l'exécution** : ni édition, ni compilation, ni autre série de tests.
- Ne lancez **pas deux scripts à la fois** (ils partagent la base jetable et les mêmes fichiers).
- Les mutants « base » utilisent la **base PostgreSQL jetable** de `apps/crm-api/scripts/test-db.mjs` (port 54341 par défaut, variable `TEST_DB_PORT`) : jamais une base réelle.
- Un script correspond au code **de son lot** : il échoue proprement (`MOTIF 0`) si le fichier visé a depuis été réécrit. Dans ce cas, mettez le motif à jour.
- La durée va de quelques minutes (mutants « unitaires ») à plus d'une demi-heure (mutants « base »).

## Écrire les mutants d'un nouveau lot

Copier le script le plus récent, puis adapter la liste `M` : un nom (`Q1 …`), le fichier visé, le motif à remplacer (il doit apparaître **une seule fois**), son remplaçant et le type de série (`unit` ou `db:<motif du test>`). Pour neutraliser une condition, remplacer sa garde par `Math.random() > 2`. Viser les règles métier, les droits (route et cas d'usage), la portée, les contraintes de la base et la persistance.
