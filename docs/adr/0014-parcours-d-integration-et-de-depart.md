# ADR-0014 — Parcours d'intégration et de départ

| | |
|---|---|
| **Statut** | Accepté (2026-11-11, décision D68 de la Direction produit : « Lançons RH-3 », puis « applique les recommandations » ; valeurs de départ « à confirmer »). |
| **Contexte** | À l'arrivée et au départ d'un employé, la RH, le responsable et l'informatique ont des tâches à faire (accès, matériel, entretien…). Aujourd'hui elles vivent dans des listes à part, sans trace de qui a fait quoi et quand. D64 option C a retenu des « parcours » sans donnée sensible. |
| **Lié à** | ADR-0009, ADR-0013 (contrats), D57, D64, D67 |

## Options considérées
1. **Statu quo** : listes à part. Aucune trace, aucun rappel des retards.
2. **Moteur de flux complet** (étapes conditionnelles, validations, notifications, pièces jointes) : lourd, et touche à des données que D57 exclut. Écartée.
3. **Modèles simples, lancés à la main, tâches cochées avec date et auteur (retenue).**

## Décision
- **Deux modèles, un par nature** : *Intégration* et *Départ* (`hr.journey_templates`), chacun une **liste ordonnée de tâches** : titre court (150 caractères au plus), **responsable dans une liste fermée** (Ressources humaines, Responsable, Employé, Informatique — une **étiquette**, pas un droit d'accès), **échéance relative** (jours avant ou après une date de référence, de -365 à +365). 1 à 30 tâches, titres distincts. La RH **remplace la liste en bloc** (version lue, audit avant / après). Modèles de départ « à confirmer » : 6 tâches d'intégration, 5 de départ.
- **Lancement à la main** (`POST /hr/journeys`) pour un employé en poste : les tâches sont **copiées** du modèle (modifier le modèle ne change **pas** les parcours déjà lancés). Date de référence : la date d'entrée (intégration) ou aujourd'hui (départ), modifiable.
- **Un seul parcours en cours par employé et par nature** : garanti par la base (index unique partiel) et par un verrou de la fiche de l'employé (lancements simultanés).
- **Cocher** une tâche garde la **date** et l'**auteur** (base : les deux ensemble ou aucun) ; la dernière tâche cochée **termine** le parcours ; **décocher** une tâche cochée par erreur le rouvre (refusé si un autre parcours de la même nature est déjà en cours) ; **annuler** un parcours en cours le conserve avec ses tâches. Une tâche non cochée dont l'échéance est dépassée est signalée « en retard » (parcours en cours seulement). Verrou optimiste par `version`, audit avant / après.
- **Droits** (`hr.journey.read`, `hr.journey.manage`) : la **RH** et le **Super administrateur** lancent, modifient les modèles, **cochent**, annulent ; la **Direction** lit tout ; **chaque employé lit ses propres parcours** ; les **responsables et collègues ne voient rien**. Hors périmètre : 404. Les modèles sont lisibles par la RH, la Direction et le Super administrateur.
- **Aucune donnée sensible** : ni texte libre, ni motif, ni pièce, ni commentaire (testé sur les colonnes et sur la réponse).

## Conséquences
- (+) Qui a fait quoi, et quand, est tracé ; les retards se voient ; les parcours se rejouent sans développement (modèles modifiables).
- (+) Un modèle modifié ne casse jamais un parcours en cours.
- (−) **Dette D182** : **seule la RH coche** les tâches. Le responsable, l'employé et l'informatique ne peuvent pas cocher « leurs » tâches (le responsable est une étiquette, pas un droit) ; à confirmer avec la RH, une permission distincte serait alors créée.
- (−) **Dette D183** : lancement **manuel** seulement ; aucune notification de retard ; aucun lien automatique avec la fin d'un contrat ni avec l'archivage de l'employé.
- (−) **Dette D184** : un modèle par nature (pas de variante par service ou par type de contrat) ; pas de description ni de document par tâche ; modification en bloc (pas d'édition tâche par tâche, ni d'historique des versions du modèle hors audit).
- À revoir si : les responsables doivent cocher leurs tâches, si un rappel par courriel devient nécessaire, ou si des variantes par service sont demandées.
