# Fiche de test — RH-3 — contrats et parcours

| | |
|---|---|
| **Session** | `rh-3` |
| **Recettes de référence** | [`SPRINT-RH-3A-RECETTE.md`](../../SPRINT-RH-3A-RECETTE.md) (API des contrats), [`SPRINT-RH-3B-RECETTE.md`](../../SPRINT-RH-3B-RECETTE.md) (API des parcours), [`SPRINT-RH-3C-RECETTE.md`](../../SPRINT-RH-3C-RECETTE.md) (écrans), [`SPRINT-RH-3D-RECETTE.md`](../../SPRINT-RH-3D-RECETTE.md) (recette complète et mutants) |
| **Étiquette** | `rh-3a-validated`, `rh-3b-validated` (3c et 3d : à la validation) |
| **Contexte** | Décisions D67 et D68, [ADR-0013](../../adr/0013-contrats-du-personnel-sans-donnees-sensibles.md), [ADR-0014](../../adr/0014-parcours-d-integration-et-de-depart.md) · valeurs de départ « à confirmer » avec la RH |
| **Écrans concernés** | [Contrats](../interfaces/34-contrats.md), [Contrats à échéance](../interfaces/35-contrats-a-echeance.md), [Parcours](../interfaces/36-parcours.md), [Un parcours](../interfaces/37-un-parcours.md), [Modèles de parcours](../interfaces/38-modeles-de-parcours.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée des recettes** du lot : en cas de doute, la recette fait foi.*

## Avant de commencer
- Réinitialiser la pile (`node scripts/local-stack.mjs reset`, puis `--demo --rebuild`) ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : RH, Super administrateur, Direction, un employé avec compte (chargé de compte), son responsable (Responsable commercial), un employé tiers.
- Le jeu de démonstration contient 12 contrats (2 terminés) et 3 parcours (1 terminé) ; vérifier d'abord que les blocs « contrats » et « parcours » sont chargés.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après les recettes) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Aucune donnée sensible | Ni salaire, ni document, ni avenant, ni texte libre : le motif de fin se choisit dans une liste de cinq ; les colonnes de la base et la réponse de l'API n'en contiennent pas | ☐ | |
| 2 | Un seul contrat en cours par employé | Créer un second contrat en cours pour le même employé : refusé avec le message du serveur ; trois créations simultanées : une réussit, deux sont refusées | ☐ | |
| 3 | Types de contrat | CDI, CDD, Stage, Prestation au départ ; un type à durée déterminée exige une fin, un CDI n'en a pas ; un type se désactive sans se supprimer ; aucune règle légale n'est appliquée | ☐ | |
| 4 | Dates | Fin avant le début refusée (le même jour est permis) ; fin d'essai dans le contrat, bornes comprises ; début avant l'entrée de l'employé refusé ; contrat qui recouvre un contrat terminé refusé | ☐ | |
| 5 | Ajuster et terminer | Prolonger la fin et déplacer l'essai (le début ne change jamais) ; terminer avec une date entre le début et la fin prévue et un motif de la liste ; un contrat terminé est conservé et ne se modifie plus | ☐ | |
| 6 | Visibilité des contrats | RH et Super administrateur : tout ; Direction : lecture ; employé : le sien ; responsable direct et collègue : rien (404, identique à un contrat inexistant) | ☐ | |
| 7 | Échéances | Fin de contrat et fin d'essai dans la fenêtre (60 jours par défaut, 1 à 365), jours restants, tri par date ; réservées à la RH à l'écran ; aucun courriel | ☐ | |
| 8 | Modèles de parcours | Deux modèles (Intégration 6 tâches, Départ 5) ; remplacer les tâches : 1 à 30, titres distincts, responsable en liste fermée, échéance entre -365 et 365 ; version périmée refusée ; audit avant et après | ☐ | |
| 9 | Lancer un parcours | Employé en poste ; un seul parcours en cours par employé et par nature ; date de référence par défaut (entrée ou aujourd'hui) ; tâches copiées : modifier le modèle ensuite ne change pas le parcours | ☐ | |
| 10 | Cocher, décocher, annuler | Cocher garde la date et l'auteur ; la dernière tâche termine le parcours ; décocher rouvre (refusé si un autre parcours de même nature est en cours) ; annuler conserve les tâches ; parcours annulé : plus rien ne se coche | ☐ | |
| 11 | Retards | Tâche non cochée dont l'échéance est passée : « En retard » ; pas pour un parcours terminé ou annulé ; pas pour une tâche due aujourd'hui | ☐ | |
| 12 | Visibilité des parcours | RH et Super administrateur : tout gérer et cocher ; Direction : lecture ; employé : les siens, sans cocher ; responsable et tiers : rien | ☐ | |
| 13 | Règles garanties par la base | Un seul contrat et un seul parcours en cours (index), états cohérents (dates et motif), coche avec auteur, bornes des échéances, aucune suppression d'un employé ou d'un type qui a des contrats | ☐ | |
| 14 | Audit | Chaque création, ajustement, fin, lancement, coche, annulation et modification de modèle écrit une ligne avec l'avant et l'après | ☐ | |
| 15 | Preuves | Mutants : voir la recette 3d (tués, survivants traités) ; collection Postman : exécutée contre une pile jetable | ☐ | |

## Écarts constatés
| Date | Vérification | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
