# RH-3a — contrats du personnel (API) : recette

*Branche `feat/rh-3-contrats-parcours` · 2026-11-11 · décision **D67** (« Lançons RH-3 », puis « applique les recommandations »), [ADR-0013](adr/0013-contrats-du-personnel-sans-donnees-sensibles.md).*

RH-3 se livre par tranches, comme RH-2 : **3a** (cette tranche : l'API des contrats), **3b** (parcours d'intégration et de départ, API), **3c** (écrans et données de démonstration), **3d** (recette complète, mutants, fiches de test).

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Types de contrat paramétrables** | `GET/POST /hr/contracts/types`, `PUT /hr/contracts/types/:id` : départ CDI, CDD, Stage, Prestation ; chaque type dit seulement s'il a une **fin obligatoire** ; un type se **désactive**, ne se supprime pas ; code et nature ne changent pas ; **aucune règle légale codée** |
| **Contrats successifs, un seul en cours** | `POST /hr/contracts`, `GET /hr/contracts`, `GET /hr/contracts/:id` ; **index unique partiel** en base + verrou de la fiche de l'employé (trois créations simultanées : une réussit, deux refusées) ; pas de chevauchement avec un contrat terminé ; pas de début avant l'entrée de l'employé |
| **Champs** | type, début, fin (vide pour la durée indéterminée), fin de période d'essai (dans le contrat), état, date de fin effective, motif de fin — **ni salaire, ni document, ni avenant, ni texte libre** (testé sur les colonnes et sur la réponse) |
| **Ajuster** | `PUT /hr/contracts/:id` : prolonger la fin, déplacer l'essai ; le début ne change jamais ; version lue, audit avant / après |
| **Terminer** | `POST /hr/contracts/:id/end` : une date (entre le début et la fin prévue) et un **motif de la liste fermée** (fin de CDD, fin d'essai, démission, fin de mission, autre) ; le contrat est conservé et ne bouge plus |
| **Droits** | RH et Super administrateur : tout voir et gérer ; **Direction : tout lire, rien écrire** ; **employé : le sien seulement** ; **responsables et collègues : rien** ; hors périmètre : 404 identique à un identifiant inexistant |
| **Échéances** | `GET /hr/contracts/deadlines?days=` (60 par défaut, 1 à 365) : fin de contrat et fin d'essai des contrats en cours, jours restants, triées par date ; RH et Direction ; aucun courriel |
| **Permissions** | `hr.contract.read` (Propre pour tous, Tous pour la Direction, la RH et le Super administrateur), `hr.contract.manage` (Tous : RH et Super administrateur) ; aucune permission de salaire n'existe |
| **Documentation de l'API** | `openapi.json` (190 opérations), référence des routes, collection Postman (182 requêtes de route, 24 étapes de parcours), `docs/RBAC.md` (120 permissions) régénérés |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | `tsc` propre (API et interface) ; `pnpm arch` : **325 modules, aucune violation** (un premier passage a refusé qu'un DTO importe le domaine : la liste des motifs y est dupliquée et un test vérifie qu'elle reste identique) |
| Tests unitaires de l'API | **1 401 réussis** (78 suites) ; nouveaux : `contract.spec` (14 : types, dates, essai, motifs, bornes), `contract-use-cases.spec` (26 : création, un seul contrat en cours, chevauchement, droits de chaque rôle, portée Propre, lecture par le responsable refusée, échéances aux bornes 60 / 61 jours, types, audit) et un cas dans `roles.spec` (matrice des rôles) |
| Tests de l'interface | **768 réussis** (les libellés de permission de l'interface restent identiques au catalogue) |
| Intégration (base jetable) | `hr-contracts-http` (**11** tests : cycle complet avec audit, création simultanée, refus métier, droits par rôle, échéances, paramétrage, absence de salaire, **règles garanties par la base** : un seul contrat en cours, dates et état cohérents, types, jamais de suppression) + `idor-contract` (4 nouvelles routes classées « objet » avec leurs sondes : même réponse pour un contrat étranger et inexistant, aucune fuite), `rbac-http`, `core-schema`, `hr-leave-http` : **186 réussis, 6 suites** |
| Migration | `20261119000000_rh_3a_contracts` appliquée sur base vierge (29 migrations) ; statut « à jour » |

## Limites connues
- **Pas encore d'écran** (tranche 3c) : l'API se teste par Postman ou par les tests.
- **Mutants et Newman non rejoués** pour cette tranche : le test de mutation des règles de contrat et le passage complet de la collection sur pile jetable sont prévus en **3d**, avec la recette de l'ensemble (la collection se construit sans erreur : toutes ses routes existent).
- **Dettes** : D179 (ni salaire, ni document, ni avenant), D180 (aucune règle légale codée : à valider par un juriste), D181 (pas de notification d'échéance ; fin de contrat et départ restent deux gestes).
- **Non vérifié** : concurrence au-delà de trois créations simultanées ; contrat d'un employé dont la fiche est ensuite archivée (il reste lisible, rien ne le termine automatiquement).

## Comment vérifier
1. `node apps/api/scripts/test-db.mjs --tests=hr-contracts-http` (base jetable, environ une minute).
2. Collection Postman : dossiers « hr » (types, contrats, échéances) ; voir `docs/api/README.md`.
