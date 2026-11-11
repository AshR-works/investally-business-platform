# Fiche de test — Modèles de parcours

| | |
|---|---|
| **Route** | `/hr/journeys/templates` |
| **Livrée par** | RH-3c (API : RH-3b ; recette et mutants : RH-3d) |
| **Accès** | Lecture : utilisateur qui détient `hr.journey.read` **en portée Tous** (RH, Direction, Super administrateur). Menu Ressources humaines › Modèles de parcours (pour qui gère). |
| **Droits** | **Modifier** : `hr.journey.manage` en portée Tous (RH, Super administrateur). La Direction lit. Employés et responsables : refus. |
| **Rôles de test** | rh, sa, dir, cc |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration : deux modèles (Départ : 5 tâches, Intégration : 6 tâches, valeurs de départ « à confirmer »). Penser à remettre les modèles de départ après les essais.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Lecture** | Se connecter en RH ; ouvrir Modèles de parcours. | Deux sections (Départ, Intégration) ; pour chaque tâche : titre, responsable, échéance en jours avec la phrase en clair (« 3 jours avant le départ ») | ☐ | |
| 2 | **Modifier une tâche** | Changer un titre, un responsable et une échéance ; « Enregistrer le modèle ». | « Le modèle est enregistré. » ; la page recharge le modèle (nouvelle version) ; l'audit garde l'avant et l'après | ☐ | |
| 3 | **Ordre** | Monter, descendre la première et la dernière tâche. | Les boutons des extrémités sont inactifs ; l'ordre enregistré est celui affiché ; chaque ligne garde ses champs | ☐ | |
| 4 | **Ajouter, retirer** | « Ajouter une tâche » jusqu'à 30 ; retirer une tâche. | La 31ᵉ n'est pas proposée ; retirer la dernière tâche signale « au moins une tâche » à l'enregistrement | ☐ | |
| 5 | **Saisie** | Titre vide, titre de 151 caractères, deux titres identiques (casse différente), échéance « 366 » ou « 1,5 ». | Chaque erreur est signalée sous le champ avec une icône et un texte ; rien n'est enregistré | ☐ | |
| 6 | **Parcours déjà lancés** | Modifier le modèle d'intégration, puis ouvrir un parcours d'intégration lancé avant. | Ses tâches n'ont pas changé ; un nouveau parcours reprend la nouvelle liste | ☐ | |
| 7 | **Conflit** | Ouvrir deux onglets, enregistrer dans l'un, puis dans l'autre. | Le second reçoit un message de conflit | ☐ | |
| 8 | **Direction** | Se connecter en Direction. | Lecture seule : tâches, responsables et phrases d'échéance, sans champs ni boutons | ☐ | |
| 9 | **Employé** | Se connecter en chargé de compte. | Pas d'entrée de menu ; l'adresse dit « réservés à la RH et à la Direction » | ☐ | |

## Accessibilité
- ☐ Clavier seul : chaque champ, liste et bouton (monter, descendre, retirer) atteignable ; focus visible.
- ☐ Chaque champ a son libellé (« Tâche 3 », « Responsable », « Échéance (jours) ») ; les boutons d'icône sont nommés (« Monter la tâche 2 »).
- ☐ Les erreurs sont reliées aux champs ; le message de succès est annoncé.
- ☐ Lisible à 200 % de zoom et à 375 px (les champs passent en colonne) ; mode sombre.

## Tests automatisés qui couvrent cet écran
- API : `hr-journeys-http.integration` (modèles, copie figée, version, audit), `journey.spec`, `journey-use-cases.spec`.
- Web : `rh-3c.test` (validation des lignes, réordonnancement, corps envoyé, clés uniques) ; mutants RH-3 ; audit navigateur : non rejoué.

## Limites connues
- Un modèle par nature, pas de variante par service ; modification en bloc, sans historique propre en dehors de l'audit (D184).
- Le responsable d'une tâche est une étiquette, pas un droit.

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
