# DDR-0008 — Champ de code unique pour le second facteur

| | |
|---|---|
| **Statut** | **Remplacée** par [DDR-0009](DDR-0009-code-en-six-cases.md) le 2026-10-22 |
| **Date** | 2026-10-22 |
| **Version du design** | 0.4.1 (écart d'implémentation, pas de nouvelle version) |
| **Lié à** | EXD-06 (écrans A02, A03, A06) |

## Contexte
Le prototype montre le code à 6 chiffres en **six cases** séparées. Dans l'application réelle, le même champ doit aussi accepter un **code de secours** (format XXXXX-XXXXX), et les gestionnaires de mots de passe et claviers mobiles proposent la saisie automatique d'un code reçu.

## Options examinées
A six cases (fidèle au prototype) · **B un champ unique, grand, chiffres espacés** · C six cases avec repli sur un champ pour les codes de secours.

## Décision
**Option B**, appliquée en implémentation (H2a) et signalée à la direction produit. Motifs : le collage et la saisie automatique fonctionnent (`autocomplete="one-time-code"`), un lecteur d'écran lit un seul champ au lieu de six, aucun piège de focus entre cases, un même composant pour le code et le code de secours. Le rendu reste proche du prototype (grande police, chiffres espacés).

## Conséquences
Réversible (un composant). Si la direction produit préfère les six cases, option C (cases pour le code, champ pour le secours), avec un test de collage et de lecteur d'écran. Nombre de codes de secours restants (A03) : non affiché, l'API ne le fournit pas (dette D39).
