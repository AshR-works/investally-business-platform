# Fiche de test — Contrats

| | |
|---|---|
| **Route** | `/hr/contracts` |
| **Livrée par** | RH-3c (API : RH-3a ; recette et mutants : RH-3d) |
| **Accès** | Utilisateur qui détient `hr.contract.read` : menu Ressources humaines › Contrats. La RH, la Direction et le Super administrateur voient tous les contrats ; un employé voit le sien (l'écran s'intitule alors « Mon contrat »). |
| **Droits** | **Créer, ajuster, terminer, gérer les types** : `hr.contract.manage` en portée Tous (RH, Super administrateur). La Direction lit sans écrire. Responsables et collègues : aucune donnée. |
| **Rôles de test** | rh, sa, dir, cc (employé), resp (responsable direct) |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration : 12 contrats (10 en cours, 2 terminés), 4 types. Comptes RH, Direction, un chargé de compte avec fiche d'employé et son responsable.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste (RH)** | Se connecter en RH ; ouvrir Contrats. | Filtre « En cours » par défaut, dix contrats : employé, type, début, fin (ou « Durée indéterminée »), fin d'essai, état, motif de fin ; onglets « Contrats » et « À échéance » | ☐ | |
| 2 | **Filtres** | Choisir « Terminés », puis « Tous ». | Deux contrats terminés avec leur motif (« Fin du contrat à durée déterminée ») ; douze au total | ☐ | |
| 3 | **Nouveau contrat** | « Nouveau contrat » : employé sans contrat en cours, type CDD, début, fin, fin d'essai ; Enregistrer. | Message « Le contrat est enregistré. » ; le contrat apparaît en cours ; le champ « Fin » n'existe pas pour un CDI | ☐ | |
| 4 | **Un seul contrat en cours** | Créer un contrat pour un employé qui en a déjà un. | Le message du serveur s'affiche dans la fenêtre (« Un contrat est déjà en cours… »), la fenêtre reste ouverte | ☐ | |
| 5 | **Règles de dates** | Fin avant le début ; CDD sans fin ; fin d'essai après la fin ; début avant l'entrée. | Chaque cas est signalé sous le champ concerné ou par le serveur, rien n'est créé | ☐ | |
| 6 | **Ajuster** | Menu de ligne › « Ajuster (fin, essai) » sur un CDD : prolonger la fin, vider l'essai. | Enregistré ; le début n'est pas modifiable ; pour un CDI, seul l'essai est proposé | ☐ | |
| 7 | **Mettre fin** | Menu de ligne › « Mettre fin au contrat » : date, motif de la liste. | Contrat « Terminé » avec date et motif ; plus d'action sur la ligne ; l'audit garde l'avant et l'après | ☐ | |
| 8 | **Types de contrat** | Section « Types de contrat » : nouveau type (code, libellé, durée déterminée), modifier, désactiver. | Le code et la nature ne changent plus après création ; un type désactivé n'est plus proposé pour un nouveau contrat mais reste sur les contrats existants | ☐ | |
| 9 | **Direction** | Se connecter en Direction. | Tous les contrats en lecture ; ni « Nouveau contrat », ni menu de ligne, ni section Types | ☐ | |
| 10 | **Employé** | Se connecter en chargé de compte. | « Mon contrat » : le sien seulement, sans colonne « Employé » ni action | ☐ | |
| 11 | **Responsable direct** | Se connecter en Responsable commercial. | Aucun contrat de son équipe (seulement le sien) ; l'adresse d'un contrat de l'équipe dit « introuvable » | ☐ | |

## Accessibilité
- ☐ Clavier seul : filtres, « Nouveau contrat », menus de ligne et fenêtres atteignables ; focus visible ; Échap ferme une fenêtre.
- ☐ Un seul titre de niveau 1 ; le tableau a une légende pour les lecteurs d'écran ; chaque menu de ligne est nommé (« Actions pour le contrat de … »).
- ☐ Les erreurs de saisie sont annoncées et reliées à leur champ ; les messages de succès et d'erreur du serveur le sont aussi.
- ☐ L'état n'est pas porté par la couleur seule (texte « En cours » / « Terminé »).
- ☐ Lisible à 200 % de zoom et à 375 px de large, sans défilement horizontal de la page ; mode sombre.

## Tests automatisés qui couvrent cet écran
- API : `hr-contracts-http.integration` (cycle complet, un seul contrat en cours même simultané, refus métier, droits par rôle, échéances, types, absence de salaire, règles de la base), `contract.spec`, `contract-use-cases.spec`, sondes anti-IDOR, matrice des rôles.
- Web : `rh-3c.test` (règles de saisie identiques au serveur, actions par état et droit, menu par profil, aucun champ de rémunération ni de texte libre) ; mutants RH-3 (voir la recette 3d) ; audit navigateur : non rejoué.

## Limites connues
- Ni salaire, ni document, ni avenant (D179) ; aucune règle légale codée (D180) ; pas de notification (D181).
- Les contrats d'un employé n'apparaissent pas encore sur sa fiche.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
