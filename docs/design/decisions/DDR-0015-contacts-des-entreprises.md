# DDR-0015 — Contacts des entreprises : fiche, liste, doublons

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-30 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.1a ; wireframes 10, 11 et 12 ; cas d'usage CU-C-10 à CU-C-14 ; décision D29 |

## Contexte
Le module commercial n'avait pas de contacts : on ne pouvait pas noter qui est le DAF ou le décideur d'une entreprise. Les cas d'usage et les wireframes avaient proposé une première forme ; ce lot la réalise avec des **valeurs par défaut**, à confirmer par la direction produit (D29).

## Décisions
1. **Où** : un panneau « Contacts » dans la fiche entreprise (liste, création, modification, suppression) et une page « Contacts » (nouveau module de la navigation) avec recherche, filtre par fonction, pagination, sélection persistante et création (l'entreprise se choisit parmi celles de sa portée).
2. **Champs** : entreprise (obligatoire, non modifiable ensuite), nom, prénom (obligatoires), **fonction** (DAF, Décideur, Autre), e-mail et téléphone (facultatifs, contrôlés s'ils sont saisis). Même mise en forme que la fiche d'entreprise : fenêtre large, champs non conformes en surbrillance (EXD-15, EXD-16).
3. **Visibilité** : un contact **suit son entreprise** ; il n'a pas de propriétaire propre. Le chargé de compte voit ceux de ses entreprises, le Responsable commercial ceux de son équipe, la Direction et le Support tous ; hors portée, l'entreprise ou le contact est « introuvable ».
4. **Doublons** : même entreprise et même nom (sans tenir compte de la casse ni des espaces) **ou** même e-mail. Le doublon est **signalé** (« Doublon probable ») et l'utilisateur peut **créer quand même** après avertissement : on propose plutôt qu'on n'interdit.
5. **Droits** : créer et modifier (chargé de compte Propre, Responsable commercial Équipe) ; **supprimer : Responsable commercial seulement** ; lire : aussi Direction et Support. Suppression logique, confirmée à l'écran, tracée dans l'audit.
6. **Entreprise archivée** : plus de création, de modification ni de suppression de contact ; les contacts restent lisibles.
7. **Modification concurrente** : verrou optimiste (version lue) ; refusée si quelqu'un a modifié entre-temps.
8. **Audit** : création, modification (ancienne et nouvelle valeur) et suppression sont tracées avec la session.

## Mesures de rigueur
- Les mêmes règles de saisie sont comparées entre l'interface et le domaine réel du serveur par des tests.
- Le contrat anti-IDOR est étendu aux cinq nouvelles routes (lecture, liste filtrée par entreprise, création, modification, suppression) : même réponse pour l'objet d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite.
- La base impose la clé étrangère vers l'entreprise et un numéro de version positif ; les doublons ne sont volontairement pas une contrainte de la base (ils sont signalés, pas interdits).

## Conséquences
- Réversible : une migration (une table), un module, trois composants.
- **Dette** : D62 à D65 (`docs/TECH-DEBT.md`) ; prototype à mettre à jour (D49).
