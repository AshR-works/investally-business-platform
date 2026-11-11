# Fiche de test — Parcours

| | |
|---|---|
| **Route** | `/hr/journeys` |
| **Livrée par** | RH-3c (API : RH-3b ; recette et mutants : RH-3d) |
| **Accès** | Utilisateur qui détient `hr.journey.read` : menu Ressources humaines › Parcours. La RH, la Direction et le Super administrateur voient tous les parcours ; un employé voit les siens (l'écran s'intitule « Mes parcours »). |
| **Droits** | **Lancer** : `hr.journey.manage` en portée Tous (RH, Super administrateur). La Direction lit sans écrire. Responsables et collègues : rien. |
| **Rôles de test** | rh, sa, dir, cc (employé), resp |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration : trois parcours (une intégration en cours avec une tâche en retard, une intégration terminée, un départ à venir).

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Liste (RH)** | Se connecter en RH ; ouvrir Parcours. | Filtre « En cours » : deux parcours ; colonnes employé, nature (lien vers le parcours), référence, avancement (« 3 sur 6 »), retards (« 1 en retard » ou « Aucun »), état | ☐ | |
| 2 | **Filtres** | Choisir « Terminés », puis la nature « Départ ». | Le parcours terminé ; puis seulement les départs ; le compte est annoncé | ☐ | |
| 3 | **Lancer un parcours** | « Lancer un parcours » : employé sans parcours en cours, nature Intégration, date de référence vide ; Lancer. | Le parcours s'ouvre ; ses six tâches ont une échéance calculée à partir de la date d'entrée | ☐ | |
| 4 | **Un seul parcours en cours** | Relancer la même nature pour le même employé. | Le message du serveur s'affiche (« Un parcours de cette nature est déjà en cours… »), la fenêtre reste ouverte ; une autre nature est permise | ☐ | |
| 5 | **Saisie** | Valider sans employé, sans nature, puis avec une date impossible. | Chaque champ est signalé sous le champ ; rien n'est lancé | ☐ | |
| 6 | **Employé archivé** | Choisir un employé sorti (s'il est proposé). | Refus du serveur ; aucun parcours créé | ☐ | |
| 7 | **Direction** | Se connecter en Direction. | Tous les parcours en lecture, sans « Lancer un parcours » | ☐ | |
| 8 | **Employé** | Se connecter en chargé de compte. | « Mes parcours » : les siens seulement, sans colonne « Employé » | ☐ | |
| 9 | **Responsable direct** | Se connecter en Responsable commercial. | Aucun parcours de son équipe ; l'adresse d'un parcours de l'équipe dit « introuvable » | ☐ | |

## Accessibilité
- ☐ Clavier seul : filtres, liste « Nature », « Lancer un parcours » et la fenêtre atteignables ; focus visible ; Échap ferme la fenêtre.
- ☐ Un seul titre de niveau 1 ; légende du tableau ; le compte est annoncé.
- ☐ Les retards et l'état se lisent en texte, pas par la couleur seule.
- ☐ Lisible à 200 % de zoom et à 375 px ; mode sombre.

## Tests automatisés qui couvrent cet écran
- API : `hr-journeys-http.integration` (lancement, un seul parcours en cours même simultané, droits, portée), `journey-use-cases.spec`, sondes anti-IDOR.
- Web : `rh-3c.test` (lancement, menu par profil, droits d'écriture) ; mutants RH-3 ; audit navigateur : non rejoué.

## Limites connues
- Lancement manuel seulement ; aucune notification (D183).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
