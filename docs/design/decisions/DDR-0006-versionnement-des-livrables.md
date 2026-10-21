# DDR-0006 — Versionnement des livrables design

| | |
|---|---|
| **Statut** | Acceptée |
| **Date** | 2026-10-21 |
| **Version du design** | 0.4.0 |
| **Lié à** | DEC-001 (gouvernance) |

## Contexte
Besoin : historique complet, comparaison, retour arrière, traçabilité des décisions de design.

## Options examinées
A copies de dossiers · B releases · C versionnement type design system · **D Git + releases sémantiques + journal + fiches de décision**.

## Décision
**Option D** : Git source de vérité ; versions `design-vMAJEUR.MINEUR.CORRECTIF` ; dossiers `releases/`, `decisions/`, `exigences/`, `outils/` ; journal `CHANGELOG-DESIGN.md` ; page de comparaison ; versions 0.1.0 à 0.3.0 reconstituées.

## Motif
Meilleure note (143/150) pour une charge faible ; évolue vers l'option C avec l'ERP sans migration.

## Conséquences
Discipline de tenue du journal ; instantanés ≈ 2 à 3 Mo par version (à sortir du dépôt au-delà d'une trentaine) ; étiquettes posées seulement à la validation.
