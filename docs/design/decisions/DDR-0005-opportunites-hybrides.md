# DDR-0005 — Opportunités hybrides

| | |
|---|---|
| **Statut** | Acceptée |
| **Date** | 2026-10-21 |
| **Version du design** | 0.4.0 |
| **Lié à** | EXD-04 ; DEC-003 (arbitrage 2) |

## Contexte
La vue en colonnes montre le processus mais compare mal ; les cartes par lignes de 6 comparent bien mais masquent les étapes.

## Options examinées
Colonnes seules · cartes seules · **hybride**.

## Décision
**Hybride** : bandeau d'étapes cliquable (nombre et montant), tri (prochaine action par défaut, montant, étape), cartes par lignes de 6 (6 dès 1 360 px), bascule « Par étape ». La **sélection survit** au tri et au filtre.

## Motif
Meilleure valeur commerciale et lisibilité (118/135) ; respecte l'exigence tout en rendant visibles les goulots et les étapes réglementées.

## Conséquences
Un seul modèle de données, deux rendus ; **alternative clavier** à prévoir pour « Par étape » (menu « Déplacer vers… ») ; mesurer l'usage après deux semaines.
