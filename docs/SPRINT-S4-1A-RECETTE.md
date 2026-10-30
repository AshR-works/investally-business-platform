# S4.1a — contacts des entreprises : recette

*Branche `sprint/s4-1a-contacts` · 2026-10-30 · cas d'usage CU-C-10 à CU-C-14 ; wireframes 11 et 12 ; DDR-0015 ; D29.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Contacts d'une entreprise** | Panneau « Contacts » dans la fiche : liste, création, modification, suppression (confirmée) |
| **Page « Contacts »** | Nouveau module de la navigation : recherche, filtre par fonction, pagination, sélection persistante, création (entreprise choisie parmi celles de la portée) |
| **Champs** | Entreprise, nom, prénom (obligatoires), fonction (DAF, Décideur, Autre), e-mail et téléphone facultatifs mais contrôlés. Champs non conformes en surbrillance (EXD-15, EXD-16) |
| **Doublons** | Même entreprise et même nom, ou même e-mail : « Doublon probable », avec le choix « Créer quand même » / « Enregistrer quand même » |
| **Visibilité** | Un contact suit son entreprise ; hors portée = « introuvable » |
| **Droits** | Créer/modifier : chargé de compte (propre), Responsable commercial (équipe) ; supprimer : Responsable commercial ; lire : aussi Direction et Support |
| **Entreprise archivée** | Plus de création, modification ni suppression ; contacts lisibles |
| **Concurrence et audit** | Verrou optimiste ; création, modification (ancienne et nouvelle valeur) et suppression tracées |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (173 modules) |
| Tests unitaires de l'API | **531 / 531** (1 ignoré, antérieur) ; 27 nouveaux (contacts) |
| **Tests d'intégration (PostgreSQL jetable)** | **211 / 211** (15 suites), dont doublons, version perdue au niveau de la base, suppression logique |
| **IDOR** | Cinq routes de contacts classées et sondées : même réponse pour l'objet d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite |
| Tests de l'interface | **208 / 208** (25 nouveaux) : validation alignée sur le domaine, corps des requêtes, doublon, droits, champs sans perte de focus |
| **Mutants** | **14 / 14 tués** (10 unitaires, 4 sur la base) ; un survivant initial (verrou optimiste non vérifié en base) a conduit à un test de concurrence au niveau du dépôt |
| **Navigateur réel (Edge + axe-core)** | **109 contrôles, 0 échec, 0 avertissement** : création refusée avec surbrillance et focus, création, doublon avec avertissement annoncé, modification, suppression confirmée, page « Contacts » ; résultats `docs/accessibilite/resultats/axe-2026-10-30-s41a.json`, captures `docs/accessibilite/s41a-captures/` |

## Réserves sur la recette
- Passage au lecteur d'écran réel non fait (protocole existant, hors de ce lot).
- Testé sous Node 26.7, pas rejoué sous Node 22.
- Les valeurs par défaut ci-dessous restent à confirmer par la direction produit (D29).
- Le prototype n'est pas mis à jour (version 0.5.0 à décider, D49).

## Dette et à confirmer
- **D62 à D65** (`docs/TECH-DEBT.md`).
- **D29 — à confirmer** : liste des fonctions (DAF, Décideur, Autre), suppression réservée au Responsable commercial, un contact rattaché à une seule entreprise.

## À valider
1. Les écrans (panneau de la fiche, page Contacts) et les valeurs par défaut de D29.
2. « Je valide S4.1a » → fusion avec commit de fusion et étiquette `s4-1a-validated`.
