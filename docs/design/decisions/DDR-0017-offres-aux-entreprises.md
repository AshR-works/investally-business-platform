# DDR-0017 — Offres faites aux entreprises : fiche, liste, cycle d'états

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-10-30 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.2a ; wireframes 13 et 14 ; cas d'usage CU-C-20 et CU-C-23 ; flux C2 ; décision D32 |

## Contexte
Le module commercial n'avait pas d'offres. Le sprint S4.2 est découpé en trois lots : **S4.2a les offres** (ce lot), S4.2b les décharges signées, S4.2c les relances. Les états exacts d'une offre étaient « à confirmer » dans les cas d'usage : ce lot les réalise avec des **valeurs par défaut**, à confirmer par la direction produit (D32).

## Décisions
1. **Où** : un panneau « Offres » dans la fiche entreprise (liste, création, modification d'un brouillon, changements d'état) et une page « Offres » (nouveau module de la navigation) avec recherche, filtre par état, pagination, sélection persistante et création (l'entreprise se choisit parmi celles de sa portée).
2. **Champs** : entreprise (obligatoire, non modifiable ensuite), objet, montant, devise (FCFA = XAF par défaut), note facultative. Référence **OFF-AAAA-NNNN** attribuée à la création (compteur par année, sans trou, transactionnel).
3. **Cycle d'états** : *Brouillon → Déposée → (Décharge reçue) → Acceptée ou Refusée* ; *Retirée* possible tant que le client n'a pas répondu. Acceptée, refusée et retirée sont **définitives**. « Décharge reçue » est prévu dans le modèle et sera branché avec S4.2b.
4. **Modification** : seulement en brouillon. Une offre déposée ne change plus (pour changer un montant, on retire l'offre et on en crée une autre) ; c'est ce qui garde l'historique fidèle à ce que le client a reçu.
5. **Confirmations** : déposer, enregistrer l'acceptation ou le refus et retirer sont confirmés à l'écran (EXD-13) ; **le retrait exige un motif**.
6. **Visibilité** : une offre **suit son entreprise** (pas de propriétaire propre) ; hors portée, l'offre ou son entreprise est « introuvable ».
7. **Droits** : lire, créer, modifier (chargé de compte Propre, Responsable commercial Équipe) ; retirer : droit `bd.offer.withdraw` (mêmes rôles) ; lire seulement : Direction. Déposer, accepter et refuser relèvent de la modification.
8. **Entreprise archivée** : plus de création ni de changement ; les offres restent lisibles.
9. **Modification concurrente** : verrou optimiste (version lue), y compris pour chaque changement d'état.
10. **Audit** : création, modification et chaque changement d'état tracés (ancienne et nouvelle valeur) avec la session.

## Mesures de rigueur
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur par des tests.
- Le contrat anti-IDOR est étendu aux huit nouvelles routes : même réponse pour l'offre d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite.
- La base garantit, quoi que fasse l'application : clé étrangère vers l'entreprise, version positive, **montant positif**, **date de dépôt cohérente avec l'état**, **motif présent pour une offre retirée**, **référence unique**.
- Une saisie refusée **ne consomme pas de numéro** : pas de trou dans la numérotation.

## Conséquences
- Réversible : une migration (deux tables), un module, cinq composants.
- **Dette** : D70 à D75 (`docs/TECH-DEBT.md`). Le wireframe 13 montre une colonne « Prochaine relance » qui arrivera avec S4.2c.
