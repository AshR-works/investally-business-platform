# DDR-0004 — Navigation B+ (hub, rail compact, bouton Déplier)

| | |
|---|---|
| **Statut** | Acceptée |
| **Date** | 2026-10-21 |
| **Version du design** | 0.4.0 |
| **Lié à** | EXD-05 ; DEC-002 (arbitrage 1) |

## Contexte
EXD-05 demande que la navigation complète n'apparaisse que sur la Vue d'ensemble. Options : A (aucune navigation hors hub), B (rail compact), C (barre pliable au choix), **B+** (B avec bouton Déplier).

## Options examinées
A : épuré mais +1 à +2 clics par changement de module. B : un clic, icônes à apprendre. C : standard mais s'écarte de la lettre d'EXD-05. B+ : défaut conforme à EXD-05, liberté de l'utilisateur.

## Décision
**B+** : hub = navigation complète + recherche globale + tuiles de modules ; autres écrans = rail compact (icônes, info-bulles, `aria-label`), lien « ← Vue d'ensemble », bouton « Déplier » mémorisé ; tiroir sur mobile ; raccourci ⌘K.

## Motif
Meilleure note de la grille (122/135) ; respect d'EXD-05 par défaut ; plusieurs moyens de navigation (WCAG 2.4.5).

## Conséquences
Deux états de la coque à maintenir ; essai avec 3 utilisateurs à prévoir ; si le rail est mal compris, bascule vers C.
