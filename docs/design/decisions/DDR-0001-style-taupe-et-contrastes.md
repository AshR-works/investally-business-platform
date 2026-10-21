# DDR-0001 — Style taupe et contrastes mesurés

| | |
|---|---|
| **Statut** | Acceptée |
| **Date** | 2026-10-21 |
| **Version du design** | 0.1.0 |
| **Lié à** | Capture de référence et logos fournis |

## Contexte
La capture de référence utilise un texte gris (#9F9F9F, 2,65 : 1), des badges pastel à 3,4–3,8 : 1 et un bouton taupe à texte blanc (2,2 : 1) : en dessous du seuil WCAG AA (4,5 : 1).

## Options examinées
1. Reproduire fidèlement la capture. 2. **Garder l'allure, assombrir les textes** et mettre du noir sur le taupe. 3. Changer de palette.

## Décision
Option 2 : mêmes teintes, textes assombris (`--ink-2` 6,8 : 1, `--muted` 4,9 : 1, statuts 4,9–5,7 : 1), bouton principal en taupe **à texte noir** (7,7 : 1), bordures de champs à 4,0 : 1.

## Motif
Respect de l'accessibilité sans trahir l'identité ; une première version avait des bordures de champs à 1,5 : 1, corrigée avant livraison.

## Conséquences
Jetons dans `prototype/tokens.css` ; vérification de contraste à refaire à chaque changement de jeton.
