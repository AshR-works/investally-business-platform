# RH-3b — parcours d'intégration et de départ (API) : recette

*Branche `feat/rh-3b-parcours` · 2026-11-11 · décision **D68** (« Lançons RH-3 », puis « applique les recommandations »), [ADR-0014](adr/0014-parcours-d-integration-et-de-depart.md).*

Deuxième tranche de RH-3 (après 3a, les contrats). Restent **3c** (écrans et données de démonstration) et **3d** (recette complète, mutants, fiches de test).

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Modèles modifiables** | `GET /hr/journeys/templates`, `PUT /hr/journeys/templates/:kind` : deux modèles (Intégration, Départ), départ « à confirmer » de 6 et 5 tâches ; chaque tâche : titre court, **responsable dans une liste fermée** (RH, Responsable, Employé, Informatique), **échéance relative** (-365 à +365 jours) ; 1 à 30 tâches, titres distincts ; la RH remplace la liste en bloc (version lue, audit avant / après) |
| **Lancement à la main** | `POST /hr/journeys` : employé en poste, nature, date de référence facultative (date d'entrée pour une intégration, aujourd'hui pour un départ) ; tâches **copiées** du modèle : modifier le modèle ne change pas les parcours déjà lancés |
| **Un seul parcours en cours** | par employé et par nature : index unique partiel en base + verrou de la fiche (trois lancements simultanés : un réussit, deux refusés) ; une autre nature, ou la même nature après annulation, reste possible |
| **Cocher avec date et auteur** | `POST /hr/journeys/:id/tasks/:taskId/complete` : date et auteur gardés (nom lisible dans la réponse, les deux ensemble en base) ; la dernière tâche cochée **termine** le parcours ; `…/reopen` décoche (refusé si un autre parcours de la même nature est en cours) ; `POST /hr/journeys/:id/cancel` annule en conservant les tâches |
| **Retards** | une tâche non cochée dont l'échéance est dépassée est signalée (`overdue`), avec un décompte par parcours ; rien pour un parcours terminé ou annulé |
| **Lecture** | `GET /hr/journeys` (filtres employé, nature, état, pagination bornée à 100), `GET /hr/journeys/:id` |
| **Droits** | RH et Super administrateur : tout gérer et cocher ; **Direction : lire tout** ; **employé : les siens** ; **responsables et collègues : rien** ; hors périmètre : 404 identique à un identifiant inexistant ; modèles lisibles par la RH, la Direction et le Super administrateur |
| **Aucune donnée sensible** | ni texte libre, ni motif, ni pièce, ni commentaire : testé sur les colonnes de la base et sur la forme de la réponse |
| **Permissions** | `hr.journey.read` (Propre pour tous, Tous pour la Direction, la RH, le Super administrateur) et `hr.journey.manage` (Tous : RH, Super administrateur) |
| **Documentation de l'API** | `openapi.json` (198 opérations), référence des routes, collection Postman (190 requêtes de route), `docs/RBAC.md` (122 permissions) régénérés |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | `tsc` propre (API et interface) ; `pnpm arch` : **332 modules, aucune violation** |
| Tests unitaires de l'API | **1 437 réussis** (80 suites) ; nouveaux : `journey.spec` (13 : validation des tâches, copie et dates relatives dont changement d'année et année bissextile, cocher, terminer, rouvrir, annuler), `journey-use-cases.spec` (22 : lancement, un seul en cours, droits de chaque rôle, copie figée, cocher avec auteur et audit, rouvrir refusé, retards, lecture par portée, modèles) et un cas dans `roles.spec` |
| Tests de l'interface | **768 réussis** (libellés de permission toujours identiques au catalogue) |
| Intégration (base jetable) | `hr-journeys-http` (cycle complet avec audit, date de référence, lancement simultané, rouvrir refusé, refus métier, droits par rôle, modèles, absence de donnée libre, **règles garanties par la base**) + `idor-contract` (5 nouvelles routes classées « objet » avec sondes : même réponse pour un parcours étranger et inexistant, aucune fuite), `hr-contracts-http`, `rbac-http`, `core-schema`, `hr-leave-http` : **203 réussis, 7 suites** |
| Migration | `20261120000000_rh_3b_journeys` appliquée sur base vierge (30 migrations) ; statut « à jour » |

## Limites connues
- **Pas encore d'écran** (tranche 3c).
- **Mutants et Newman non rejoués** pour cette tranche (prévus en **3d**) ; la collection se construit sans erreur, donc toutes ses routes existent.
- **Dettes** : D182 (**seule la RH coche** : le responsable, l'employé et l'informatique ne cochent pas leurs tâches), D183 (lancement manuel, pas de notification, pas de lien automatique avec les contrats ni l'archivage), D184 (un modèle par nature, pas de variante ni de description par tâche).
- **Valeurs prises sans réponse explicite, à confirmer avec la RH** : le contenu des deux modèles de départ, les quatre responsables, « seule la RH coche ».
- **Non vérifié** : concurrence au-delà de trois lancements simultanés ; cocher la même tâche depuis deux sessions en même temps (le verrou de version la refuse, testé en séquence).

## Comment vérifier
1. `node apps/crm-api/scripts/test-db.mjs --tests=hr-journeys-http` (base jetable, environ une minute).
2. Collection Postman : dossiers « hr » (parcours, modèles) ; voir `docs/api/README.md`.
