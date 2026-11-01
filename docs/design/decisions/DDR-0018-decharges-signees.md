# DDR-0018 — Décharges signées des offres

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-02 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.2b ; wireframes 14 et 15 ; cas d'usage CU-C-21 ; flux C2 ; décision D33 |

## Contexte
Une offre déposée chez une entreprise doit pouvoir prouver qu'elle a été reçue : l'entreprise signe une **décharge**. Ce lot l'enregistre avec son fichier signé, fait passer l'offre à « Décharge reçue » et prépare les relances (S4.2c). Il rattache aussi les **documents à l'offre** (le fichier envoyé au client, D72).

## Décisions
1. **Où** : action « Décharge signée » dans le menu d'une offre déposée (fiche entreprise et page « Offres »), qui ouvre une fenêtre : enregistrer, consulter, annuler.
2. **Champs** : date de réception, personne qui a remis la décharge, **fichier signé obligatoire** (PDF, image, document ; contrôlé par son contenu comme tout document).
3. **Règles** : seulement pour une offre **déposée** ; **une seule décharge valide par offre** ; la date ne peut être ni dans le futur ni antérieure au dépôt de l'offre.
4. **Effet sur l'offre** : l'enregistrement la fait passer à « Décharge reçue » ; l'annulation de la décharge la ramène à « Déposée ». Impossible d'annuler une fois que le client a répondu ou que l'offre est retirée.
5. **Annulation** : motif obligatoire ; la décharge annulée reste visible dans l'historique (jamais supprimée) et une nouvelle décharge peut être enregistrée.
6. **Fichiers** : le fichier signé est un document rattaché à la décharge, visible et téléchargeable comme n'importe quel document, et **jamais plus accessible que l'offre**. L'offre elle-même peut recevoir des documents (action « Documents de l'offre »).
7. **Droits** : lire, créer, modifier (annuler) : chargé de compte (Propre), Responsable commercial (Équipe) ; lecture seule pour la Direction ; hors portée, « introuvable ».
8. **Entreprise archivée** : plus d'enregistrement ni d'annulation ; la décharge reste lisible.
9. **Audit** : l'enregistrement et l'annulation de la décharge sont tracés **avec** le changement d'état de l'offre, dans la même transaction.

## Mesures de rigueur
- La base garantit, quoi que fasse l'application : **une seule décharge valide par offre** (index unique partiel : deux enregistrements simultanés, le second est refusé), annulation cohérente (motif et date présents ou absents ensemble), version positive.
- L'unicité est testée **sans l'aide de l'application** (écritures directes refusées) et en course (deux enregistrements simultanés : un succès, un conflit).
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur par des tests.
- Le contrat anti-IDOR est étendu aux quatre nouvelles routes ; les fichiers d'une décharge ou d'une offre ne sont ni lisibles ni déposables par un collègue (même réponse que pour un objet inexistant).

## Conséquences
- Réversible : une migration (une table), un module, trois composants.
- **Dette** : D76 à D79 (`docs/TECH-DEBT.md`) ; D70 et D72 sont soldées.
