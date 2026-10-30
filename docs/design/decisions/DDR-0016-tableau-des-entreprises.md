# DDR-0016 — Tableau des entreprises : filtres, tri, effectifs, colonnes

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-30 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.1b ; ARB-API-1 option C ; D38 ; EXD-02, EXD-04 ; décision D30 |

## Contexte
Le tableau des entreprises ne proposait que la recherche par nom et la pagination. La direction produit a demandé le lot « tableaux » (ARB-API-1 C) et s'est interrogée sur l'affichage « en bulles » choisi au début.

## Décisions
1. **Filtre par statut avec effectifs** : boutons à bascule « Toutes · Cible · Contactée · Qualifiée · Cliente · Archivée », chacun avec son nombre. Les effectifs tiennent compte de la recherche, du pays et du secteur, **pas du statut** (sinon les autres boutons afficheraient 0).
2. **Filtres Pays et Secteur** : listes des valeurs réellement présentes **dans la portée de l'utilisateur** (aucune valeur d'une entreprise hors portée n'est révélée). Comparaison sans tenir compte de la casse.
3. **Tri par colonne** (nom, secteur, pays, statut, date de création) : en-tête = bouton, sens annoncé par `aria-sort`. Fait par le serveur sur **toutes** les pages ; les valeurs absentes passent toujours en dernier ; un second critère (identifiant) rend la pagination stable. Un champ de tri inconnu est refusé (400), jamais passé à la base.
4. **Colonnes au choix** : menu « Colonnes » (cases à cocher) ; **e-mail** et **téléphone** proposés, masqués par défaut ; la colonne du nom est toujours affichée ; le choix est mémorisé dans le navigateur, et une valeur mémorisée abîmée retombe sur le défaut.
5. **Réinitialiser les filtres** (bouton visible seulement si un filtre est actif) et compteur annoncé aux lecteurs d'écran (« n entreprises correspondantes »).
6. **Affichage en bulles (cartes)** : la décision d'origine (DEC-003, EXD-04) concerne les **Opportunités** (S4.3). Les entreprises restent un **tableau** ; une bascule « Cartes » est possible plus tard sans changer l'API (D30, à confirmer).

## Mesures de rigueur
- Nouvelle route `GET /companies/overview` (effectifs + valeurs de filtre) : même permission que la liste, portée appliquée côté serveur, jamais depuis la requête.
- Tests : portée de la synthèse (le collègue n'est pas révélé), casse, valeurs absentes en dernier, pagination qui garde tri et filtres, refus de `sort=passwordHash` et de `sort=name;drop`.

## Conséquences
- Réversible : aucune migration, une route, un port de lecture, deux composants.
- **Dette** : D66 à D69 (`docs/TECH-DEBT.md`).
