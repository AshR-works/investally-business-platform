# Fiche de test — Contrats à échéance

| | |
|---|---|
| **Route** | `/hr/contracts/deadlines` |
| **Livrée par** | RH-3c (API : RH-3a ; recette et mutants : RH-3d) |
| **Accès** | Utilisateur qui détient `hr.contract.manage` **en portée Tous** (RH, Super administrateur) : menu Ressources humaines › Contrats à échéance. |
| **Droits** | **Voir les échéances** : RH et Super administrateur à l'écran. L'API laisse aussi la Direction lire (D181) ; responsables, collègues et employés : refus. |
| **Rôles de test** | rh, sa, dir, cc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration : quatre échéances proches (un stage dont l'essai et la fin approchent, un CDD dont l'essai approche, un CDD qui se termine dans le mois) et un CDD qui se termine dans plus de 60 jours.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Accès** | Se connecter en RH ; ouvrir Contrats à échéance. | Période « 60 prochains jours » ; tableau : date, échéance, employé, nature (fin du contrat ou de la période d'essai), contrat ; trié par date | ☐ | |
| 2 | **Teintes** | Lire la colonne « Échéance ». | Dans la semaine : rouge ; dans le mois : orange ; au-delà : neutre ; chaque pastille dit « Dans N jours », « Demain » ou « Aujourd'hui » (texte, pas la couleur seule) | ☐ | |
| 3 | **Période** | Choisir 30, 90, 365 jours. | Le nombre d'échéances suit ; le compte est annoncé (« 4 échéances ») ; à 90 jours apparaît le CDD qui se termine dans 75 jours | ☐ | |
| 4 | **Contrat terminé** | Terminer un contrat de la liste (écran Contrats), revenir. | Ses échéances ont disparu | ☐ | |
| 5 | **Vide** | Choisir une période sans échéance. | « Aucune échéance dans les N prochains jours. » | ☐ | |
| 6 | **Refus aux autres** | Se connecter en chargé de compte, puis en Direction. | Pas d'entrée de menu ; l'adresse dit « réservées à la RH » ; l'API refuse (403) à l'employé | ☐ | |
| 7 | **Aucun courriel** | Observer les journaux d'envoi. | Aucun message n'est envoyé pour une échéance | ☐ | |

## Accessibilité
- ☐ Clavier seul : la liste « Période » et le tableau se parcourent dans l'ordre ; focus visible.
- ☐ Un seul titre de niveau 1 ; légende du tableau pour les lecteurs d'écran ; le compte est annoncé (`aria-live`).
- ☐ Les pastilles se lisent sans la couleur.
- ☐ Lisible à 200 % de zoom et à 375 px ; mode sombre.

## Tests automatisés qui couvrent cet écran
- API : `hr-contracts-http.integration` (échéances, fenêtre, refus), `contract-use-cases.spec` (bornes à 60 et 61 jours, aujourd'hui inclus, tri).
- Web : `rh-3c.test` (teintes, libellés, menu) ; mutants RH-3 ; audit navigateur : non rejoué.

## Limites connues
- Aucune notification (D181) ; fenêtre de 1 à 365 jours.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
