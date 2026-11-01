# DDR-0021 — Opportunités : pipeline commercial

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-05 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.3a ; wireframes 19 à 22 ; cas d'usage CU-C-40 à CU-C-43 et CU-F1-03, CU-F1-04 ; flux C4 et F1 ; décisions D28, D30 (DEC-003) et D36 |

## Contexte
Une entreprise qui avance vers un contrat devient une **opportunité** que l'équipe suit d'étape en étape, du premier échange à l'agrément. Ce lot donne le pipeline : créer, faire avancer, accorder une dérogation, clore perdue ou gagnée, et voir l'ensemble en cartes ou par étape. Les règles laissées « à trancher » (étapes, retour en arrière, motifs de perte, clôture gagnée) sont appliquées par défaut, à confirmer (D36). Le reste de S4.3 (statuts d'une entreprise, réattribution du propriétaire, fiche 360°) est reporté en S4.3b.

## Décisions
1. **Où** : une page « Opportunités » (module du hub livré) : **cartes** par lignes de six (DEC-003, EXD-04) ou colonnes **« Par étape »** (bascule), filtres Ouvertes / Gagnées / Perdues / Toutes, recherche par intitulé, effectif et total des montants. Depuis la fiche d'une entreprise, « Nouvelle opportunité » préremplit l'entreprise.
2. **Champs** : entreprise (obligatoire, non modifiable), intitulé, montant estimé (positif, deux décimales), devise (XAF par défaut), **source** (prospection, recommandation ou facilitateur, événement, demande entrante, autre). Plusieurs opportunités peuvent coexister pour une même entreprise.
3. **Cinq étapes, dans l'ordre** : Qualification, Proposition, Négociation, Accord de principe, Agrément (noms du prototype). On avance **d'une étape à la fois**, sans retour en arrière ; chaque passage est tracé et daté. L'alternative au glisser-déposer est le menu « Déplacer vers « étape » » (clavier).
4. **Règle du rendez-vous décideur (F1)** : le passage à « Accord de principe » exige qu'au moins un **rendez-vous « décideur » soit tenu** pour l'entreprise (l'agenda de S4.2d), ou qu'une **dérogation** ait été accordée. Le refus renvoie vers la dérogation. Un rendez-vous seulement planifié, annulé, ou d'un autre type ne compte pas.
5. **Dérogation** (CU-F1-04) : réservée au **Responsable commercial** (droit `bd.opportunity.override`), **justification obligatoire**, une seule fois, avant l'accord de principe ; tracée.
6. **Clôture perdue** (D28) : par le **chargé de compte** pour les siennes (le Responsable commercial pour son équipe) ; **motif obligatoire** choisi dans une **liste fermée** (prix, concurrent retenu, pas de budget, plus de réponse, plus intéressé, autre) ; « autre » exige une précision ; possible à toute étape.
7. **Clôture gagnée** (D28) : **Responsable commercial seulement** (droit `bd.opportunity.close_won`), **au plus tôt à l'accord de principe**. L'agrément et la commission qu'elle doit déclencher arrivent avec S4.4.
8. **Immuable après clôture** : une opportunité gagnée ou perdue ne se modifie plus (ni intitulé, ni étape, ni clôture) ; il n'y a pas de réouverture dans cette version.
9. **Droits** : lecture : chargé de compte (les siennes), **Responsable commercial et Direction : toutes** (CU-C-43, lecture seule pour la Direction) ; créer, modifier, avancer : chargé de compte (Propre), Responsable commercial (Équipe) ; un objet hors portée d'écriture est « introuvable ». Les trois droits nouveaux remplacent l'ancien `bd.opportunity.close` : `close_lost`, `close_won`, `override`.
10. **Entreprise archivée** : plus de création, de modification, d'avancement ni de clôture ; les opportunités restent lisibles.

## Mesures de rigueur
- La base garantit : une opportunité ouverte n'est pas close ni motivée ; une perdue a sa date **et** son motif ; une gagnée a franchi l'accord de principe ; dérogation et justification vont ensemble ; montant et version positifs ; vérifié par des écritures directes refusées.
- Les règles (ordre des étapes, rendez-vous décideur, dérogation, motifs, immuabilité, portée, droits par action) sont couvertes par des tests unitaires et d'intégration ; des fautes injectées sont toutes détectées (voir la recette).
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur.
- Le contrat anti-IDOR est étendu aux huit nouvelles routes. Exception documentée : le Responsable commercial lit toutes les opportunités (matrice RBAC), donc ses routes de lecture ne sont pas sondées comme « attaquant » ; ses routes d'écriture le sont.

## Conséquences
- Réversible : une migration (une table), un module, trois composants et une page.
- **Dette** : D93 à D99 (`docs/TECH-DEBT.md`).
