# DDR-0003 — Panneau principal et sélection persistante

| | |
|---|---|
| **Statut** | Acceptée |
| **Date** | 2026-10-21 |
| **Version du design** | 0.3.0 |
| **Lié à** | EXD-01, EXD-02 |

## Contexte
La zone principale manquait de contraste avec le fond ; la sélection d'une ligne paraissait temporaire.

## Options examinées
1. Ombres plus fortes. 2. **Fond global plus foncé + panneau bordé et ombre légère**. 3. Séparateurs seuls. Pour la sélection : couleur seule ou **fond + barre + case**.

## Décision
Panneau sur fond global (`--canvas`) ; sélection par fond teinté, barre latérale de 4 px et case cochée, persistante jusqu'à désélection, avec barre d'actions « n sélectionnées ».

## Motif
Profondeur sans ombres fortes ; trois indices (jamais la couleur seule).

## Conséquences
Le texte posé sur le fond global passe en `--ink-2` (contraste 5,2 : 1 ; `--muted` n'atteignait que 3,9 : 1).
