# DDR-0007 — Panneau principal centré (option B) et bouton de dépliage en pictogramme

| | |
|---|---|
| **Statut** | Acceptée (centrage) · pictogramme **à confirmer** |
| **Date** | 2026-10-21 |
| **Version du design** | 0.4.1 |
| **Lié à** | EXD-10, EXD-11 ; DEC-007 ; précise DDR-0004 (DEC-002) |

## Contexte
Le panneau principal occupait tout l'espace à droite de la navigation et restait collé à elle sur grand écran. La direction produit demande qu'il soit **centré à tout moment**, et que le bouton de dépliage soit un **pictogramme** représentant l'action, toujours utilisable.

## Options examinées (centrage)
A centré dans l'espace à droite de la navigation · **B centré sur la fenêtre, repli automatique en A quand la fenêtre est trop étroite** · C toujours centré avec marges symétriques, navigation dépliée en surimpression · D statu quo.
Notes pondérées (fidélité 35, stabilité 15, petits écrans 20, 6 cartes 15, coût 15) : A 3,85 · **B 4,00** · C 3,50 · D 3,25.

## Décision
**Option B**, choisie par la direction produit le 2026-10-21.
- Grille à trois colonnes : marge gauche (au moins la largeur de la navigation), panneau (1 440 px au plus), marge droite libre. Quand la fenêtre est assez large, les deux marges sont égales : le panneau est **centré sur la fenêtre** et **ne bouge pas** quand on déplie la navigation. Quand elle est trop étroite, la marge droite tombe à zéro et le panneau occupe l'espace restant : repli en A, **sans requête média**.
- Le contenu des pages remplit le panneau (la largeur maximale de 1 320 px du contenu est supprimée, elle le décentrait).
- Bouton de dépliage : **pictogramme seul** (44 × 44 px), nom accessible et info-bulle « Déplier / Replier la navigation », état `aria-expanded`, pictogramme qui change selon l'état.

## Mesures (navigateur réel, panneau 1 440 px)
Fenêtre 2 200 px : marges gauche et droite égales (à la barre de défilement près), rail comme navigation dépliée. Fenêtre 1 700 px : centré avec le rail, repli avec la navigation dépliée. 1 360 px : repli. Aucun chevauchement navigation / panneau.

## Points ouverts
1. **Pictogramme** : panneau latéral avec chevron (proposé, appliqué à titre provisoire) ou chevron double — à confirmer.
2. **Hub (Vue d'ensemble)** : le bouton y reste masqué, la navigation y étant toujours complète (DEC-002). À confirmer.
3. **Défilement horizontal** entre 901 et 1 100 px avec la navigation dépliée : **déjà présent** avant cette version (tableaux), à traiter à part.

## Conséquences
Réversible (un fichier de styles). Le libellé texte « Déplier » disparaît visuellement (il reste lu par les lecteurs d'écran). Dette : tester chaque nouvel écran à la largeur de repli.

## Réalisation (H1, 2026-10-21)
Implémenté dans `apps/crm-web` (`components/app-shell.tsx`) avec les mêmes règles : grille à trois colonnes, repli automatique. Mesuré dans un navigateur réel : à 2 200 px marges de 373 px de chaque côté, à 1 280 px repli sans chevauchement. Le bouton est un `button` nommé « Navigation complète » (`aria-expanded`), info-bulle « Déplier / Replier la navigation ».
