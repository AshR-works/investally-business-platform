# DDR-0024 — Agréments : la promesse de paiement signée d'une opportunité

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-08 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.4a ; wireframe 23 ; cas d'usage CU-F1-05 ; flux F1 et C5 ; décisions D1 à D5 et D39 |

## Contexte
Une opportunité qui a obtenu l'accord de principe doit se concrétiser par un **agrément** : la promesse de paiement signée par l'entreprise cliente. C'est lui qui fait d'un prospect un client et qui ouvrira les inscriptions d'Investudy. Les points laissés « à trancher » (D1 à D5 : places ou somme, payeur tiers, expiration, effet sur les inscriptions, suivi du paiement) reçoivent les valeurs du registre ; elles sont **à confirmer** (D39).

## Décisions
1. **Où** : un panneau « Agréments » sur la **fiche de l'entreprise** (opportunité, ce qui est couvert, date de réception, validité, état) et une fenêtre « Enregistrer un agrément ». Pas de page transverse dans cette version.
2. **Quand** : on enregistre l'agrément d'une **opportunité qui a franchi l'accord de principe** (étape « Accord de principe » ou « Agrément », ouverte ou gagnée) et qui **n'est pas perdue**. **Un seul agrément actif** (reçu ou honoré) par opportunité ; corriger une saisie = annuler puis réenregistrer.
3. **Ce qu'il couvre (D1)** : une **somme**, un **nombre de places**, ou **les deux** (au moins l'un des deux) ; devise XAF par défaut. **Payeur : le client seulement** (D2), donc pas de champ.
4. **Dates (D3)** : date de **réception** (réelle, pas dans le futur) et **fin de validité facultative** (jamais avant la réception). L'**expiration est manuelle** : une validité dépassée est seulement signalée sur la fiche.
5. **Document signé** : joint à l'enregistrement (catégorie « Agrément signé » du module Documents) ; il n'est visible que dans la portée de l'agrément.
6. **États** : **reçu → honoré**, ou **expiré / annulé** (avec un **motif obligatoire**). Honoré, expiré et annulé sont **définitifs**. Pas d'état « demandé » (D111).
7. **Droits** : lire et enregistrer : chargé de compte (ses entreprises), Responsable commercial (son équipe), Direction (lecture) ; **honorer** et **annuler / expirer** sont deux droits distincts, tenus par le Responsable commercial.
8. **Paiement (D5)** : le CRM ne suit pas le paiement effectif ; « honoré » est constaté à la main (D112) en attendant le module Finance.
9. **Entreprise « Cliente » (flux C5)** : l'enregistrement fait passer l'entreprise à **« Cliente »** (statut qu'aucune action manuelle ne pose), tracé dans l'audit. Si l'agrément est ensuite annulé ou expiré, l'entreprise **reste cliente** (D115).
10. **Investudy** : l'événement « agrément accordé » est enregistré sur l'agrément mais **aucun consommateur n'existe encore** (D113) ; la règle D4 (signaler les inscriptions d'un agrément annulé) attend les inscriptions.
11. **Entreprise archivée** : plus d'enregistrement ni de clôture ; les agréments restent lisibles.

## Mesures de rigueur
- La base garantit : un seul agrément actif par opportunité ; montant et places positifs ; **au moins l'un des deux** ; validité jamais avant la réception ; un agrément reçu n'est pas clos, un clos a sa date, un expiré ou annulé a son motif ; version positive ; liens vers des opportunités et entreprises existantes (vérifié par des écritures directes refusées).
- Les règles (accord de principe, perdue, un seul actif, montants, dates, motifs, définitif, droits distincts, portée) sont couvertes par des tests unitaires et d'intégration ; des fautes injectées sont toutes détectées (voir la recette).
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur.
- Le contrat anti-IDOR est étendu aux six nouvelles routes.

## Conséquences
- Réversible : une migration (une table), un module, trois composants.
- **Dette** : D111 à D117 (`docs/TECH-DEBT.md`) ; D105 soldée.
