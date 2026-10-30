# DDR-0013 — Fenêtres : croix de fermeture, largeur minimale ; champs non conformes en surbrillance ; zones de texte à taille fixe

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-29 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | EXD-15, EXD-16 ; retours de tests de la direction produit du 2026-10-29 sur la fiche d'entreprise (S4.0) |

## Contexte
Les premiers essais de la fiche d'entreprise ont montré cinq défauts d'usage : fermeture des fenêtres peu intuitive, fenêtres trop étroites pour disposer correctement les champs, champs non conformes peu visibles, zones de commentaire que l'on peut étirer à la main, et pays de l'entreprise absent.

## Décisions
1. **Croix de fermeture en haut à droite de chaque fenêtre** (nom accessible « Fermer la fenêtre », pictogramme de croix, même jeu de pictogrammes que le reste de l'application). Le bouton « Fermer » du bas est **supprimé**. Échap continue de fermer. Le focus entre dans le premier champ (jamais sur la croix quand il y a un champ).
2. **« Annuler » est conservé** à côté de l'action principale des formulaires et des confirmations : c'est un **choix explicite** (renoncer à l'action), pas une simple fermeture de la fenêtre.
3. **Largeur minimale** : 26 rem pour une fenêtre normale, 46 rem pour une fenêtre large, ramenée à la largeur de l'écran sur un écran plus étroit. **Toute fenêtre qui contient un tableau est une fenêtre large** (retour du même jour sur la fenêtre « Versions d'un document », où le bouton « Télécharger » était coupé et obligeait à faire défiler) ; un test le vérifie pour chaque fenêtre.
4. **Champs non conformes en surbrillance** : après une première tentative d'envoi, chaque champ erroné reçoit une bordure, un fond et un liseré de la couleur d'erreur, **un message écrit juste dessous avec un pictogramme** (la couleur seule ne porte jamais l'état), `aria-invalid` et `aria-describedby` ; le premier champ en erreur reçoit le focus ; la surbrillance disparaît dès que la saisie est corrigée. Un récapitulatif annoncé (`role="alert"`) liste les corrections.
5. **Zones de texte à taille fixe** : plus de redimensionnement à la main (`resize: none`), défilement interne au-delà, limite de 2 000 caractères avec compteur annoncé. Cela évite des mises en page déformées et des saisies démesurées.
6. **Pays d'affiliation de l'entreprise** : champ facultatif de la fiche, saisie libre avec suggestions (Afrique centrale et de l'Ouest d'abord) ; affiché dans la fiche.

## Mesures de rigueur
- Les règles de surbrillance sont **les mêmes** que les contrôles de saisie existants (un test vérifie que la liste de messages et le contrôle champ par champ restent identiques).
- Une erreur de conception évitée : le composant de champ est défini **hors du rendu**, sinon les champs seraient recréés (focus perdu) à chaque frappe ; un test le vérifie.

## Conséquences
- Réversible : styles globaux, composant `Modal`, fenêtre de création d'entreprise.
- **Dette** : D57 (pays en saisie libre) ; prototype à mettre à jour (D49).
