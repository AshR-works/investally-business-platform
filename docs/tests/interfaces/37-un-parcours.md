# Fiche de test — Un parcours

| | |
|---|---|
| **Route** | `/hr/journeys/[id]` |
| **Livrée par** | RH-3c (API : RH-3b ; recette et mutants : RH-3d) |
| **Accès** | Utilisateur qui détient `hr.journey.read` pour ce parcours : la RH, la Direction et le Super administrateur pour tout ; l'employé pour les siens. Hors périmètre : « Parcours introuvable ». |
| **Droits** | **Cocher, décocher, annuler** : `hr.journey.manage` en portée Tous (RH, Super administrateur) ; les autres lisent (D182). |
| **Rôles de test** | rh, sa, dir, cc, resp |

*Fiche d'interface de la [charte de tests](../../CHARTE-DE-TESTS.md). À rejouer à chaque changement de l'écran. Cocher, dater, signer ; tout écart devient un défaut.*

## Préconditions
Pile locale avec le jeu de démonstration : une intégration en cours (trois tâches cochées, une en retard), une intégration terminée, un départ à venir.

## Scénarios
| N° | Scénario | Étapes | Résultat attendu | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|---|
| 1 | **Lecture** | Ouvrir l'intégration en cours (RH). | En-tête « Intégration : … », employé (lien), état, date de référence, avancement avec barre, retards ; six tâches avec responsable et échéance ; les tâches cochées sont barrées avec « fait le … par … » | ☐ | |
| 2 | **En retard** | Repérer la tâche non cochée dont l'échéance est passée. | Pastille « En retard » ; aucune pour une tâche due aujourd'hui, ni sur un parcours terminé ou annulé | ☐ | |
| 3 | **Cocher** | Cocher la tâche en retard. | La coche est enregistrée avec la date et l'auteur ; avancement et retards se mettent à jour ; pas de rechargement de la page | ☐ | |
| 4 | **Terminer** | Cocher toutes les tâches (parcours de démonstration terminé : voir son état). | À la dernière coche, l'état devient « Terminé » avec sa date ; les cases restent décochables | ☐ | |
| 5 | **Décocher** | Décocher une tâche d'un parcours terminé. | Le parcours redevient « En cours » ; la date et l'auteur de la tâche sont effacés ; refusé (message du serveur) si un autre parcours de même nature est déjà en cours pour cet employé | ☐ | |
| 6 | **Modification concurrente** | Ouvrir le parcours dans deux onglets ; cocher dans l'un, puis dans l'autre. | Le second reçoit un message de conflit et la page se recharge à jour | ☐ | |
| 7 | **Annuler** | « Annuler le parcours » › confirmer. | État « Annulé » avec sa date ; les tâches sont conservées, plus aucune case n'est active ; le bouton disparaît | ☐ | |
| 8 | **Direction et employé** | Ouvrir le parcours en Direction, puis en chargé de compte (le sien). | Lecture seule : cases inactives, pas de bouton d'annulation ; le texte « Seule la RH coche les tâches. » | ☐ | |
| 9 | **Hors périmètre** | Ouvrir l'adresse d'un parcours d'un tiers (responsable direct, collègue). | « Parcours introuvable » ; même réponse pour une adresse inexistante | ☐ | |

## Accessibilité
- ☐ Clavier seul : Tab atteint chaque case ; la barre d'espace coche ; focus visible ; l'action est confirmée à l'écran.
- ☐ Chaque case est reliée à son libellé (le titre de la tâche) ; la barre d'avancement est annoncée (`role=progressbar`, valeur en pourcentage).
- ☐ Les erreurs (conflit, refus) sont annoncées (`role=alert`) ; les tâches en retard se lisent en texte.
- ☐ Lisible à 200 % de zoom et à 375 px ; mode sombre.

## Tests automatisés qui couvrent cet écran
- API : `hr-journeys-http.integration` (cycle complet, rouvrir refusé, droits, audit), `journey.spec` et `journey-use-cases.spec`.
- Web : `rh-3c.test` (action par tâche selon l'état et le droit, avancement, annulation) ; mutants RH-3 ; audit navigateur : non rejoué.

## Limites connues
- Seule la RH coche (D182) ; pas de commentaire ni de pièce jointe par tâche (D184).

## Écarts constatés
| Date | Scénario | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
