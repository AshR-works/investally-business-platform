# S4.2a — offres faites aux entreprises : recette

*Branche `sprint/s4-2a-offres-decharges` · 2026-10-30 · cas d'usage CU-C-20 et CU-C-23 ; flux C2 ; DDR-0017 ; décision D32. Premier des trois lots de S4.2 : offres (ce lot), décharges (S4.2b), relances (S4.2c).*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Offres d'une entreprise** | Panneau « Offres » dans la fiche : liste, création, modification d'un brouillon, changements d'état |
| **Page « Offres »** | Nouveau module de la navigation : recherche, filtre par état, pagination, sélection persistante, création (l'entreprise se choisit parmi celles de la portée) |
| **Champs** | Entreprise, objet, montant, devise (FCFA = XAF par défaut), note ; **référence OFF-AAAA-NNNN** attribuée à la création |
| **Cycle d'états** | Brouillon → Déposée → (Décharge reçue) → Acceptée ou Refusée ; Retirée tant que le client n'a pas répondu ; acceptée, refusée et retirée sont définitives |
| **Modification** | Seulement en brouillon (une offre déposée se retire et se remplace) |
| **Confirmations** | Déposer, enregistrer l'acceptation ou le refus, retirer : confirmés à l'écran ; **retrait avec motif obligatoire** |
| **Visibilité et droits** | L'offre suit son entreprise ; chargé de compte (Propre), Responsable commercial (Équipe), Direction en lecture seule ; hors portée = « introuvable » |
| **Concurrence et audit** | Verrou optimiste pour chaque écriture ; création, modification et changements d'état tracés (ancienne et nouvelle valeur) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (183 modules) |
| Tests unitaires de l'API | **582 / 582** (1 ignoré, antérieur) ; 51 nouveaux (domaine de l'offre : 27 ; cas d'usage : 24) |
| **Tests d'intégration (PostgreSQL jetable)** | **238 / 238** (17 suites) ; 11 nouveaux : cycle complet, transitions interdites, retrait, portée et droits, liste sans filtre, **numérotation simultanée**, verrou optimiste au niveau de la base, règles de la base, entreprise archivée, audit, validation |
| **IDOR** | Les huit routes d'offre sont classées « objet » et sondées : même réponse pour l'offre d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite (objet de la sonde absent des réponses) |
| Règles garanties par la base | Montant positif, date de dépôt cohérente avec l'état, motif présent pour une offre retirée, référence unique, version positive : chacune vérifiée par une écriture directe refusée |
| Tests de l'interface | **259 / 259** (36 nouveaux) : montants, saisie, corps des requêtes, actions disponibles selon l'état et les droits, états ; **cohérence avec le domaine réel du serveur** sur 21 saisies |
| **Mutants** | **14 / 14 tués** (modification hors brouillon, acceptation d'un brouillon, retrait d'une offre acceptée, motif trop court, retrait sous le droit de lecture, version ignorée, entreprise archivée modifiable, numéro consommé avant validation, portée de la liste, compteur, verrou de la base, trois règles de la base). Un survivant initial (archivée modifiable) a conduit à un test supplémentaire |
| **Navigateur réel (Edge + axe-core)** | Voir les réserves : les **14 contrôles propres aux offres** passent, 0 violation ; résultats `docs/accessibilite/resultats/axe-2026-10-30-s42a.json`, captures `docs/accessibilite/s42a-captures/` |

## Réserves sur la recette
- **Le parcours navigateur complet n'a pas pu être mené à son terme.** Sur cinq exécutions, aucune n'est allée jusqu'au bout : le navigateur sans fenêtre a cessé de répondre à des endroits différents (écran des sessions, écran des codes de secours, captures d'écran), sans lien visible avec les offres ; le serveur et l'API répondaient normalement. L'audit du lot précédent (S4.1b) était allé au bout sur la même machine. **Dans les quatre exécutions dont j'ai relu le détail, les 14 contrôles propres aux offres ont tous été atteints et ont tous réussi** (création refusée avec surbrillance et focus, création, modification, dépôt confirmé, menu selon l'état, retrait sans motif refusé puis accepté avec motif, page « Offres » et filtre par état). La cause du blocage du navigateur n'est pas élucidée : les écrans des lots précédents situés après le point d'arrêt ne sont **pas** revérifiés par ce lot.
- La capture du retrait sans motif n'a pas pu être produite (délai dépassé du navigateur).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22.
- Les valeurs par défaut de D32 restent à confirmer (états, modification limitée au brouillon, qui enregistre la réponse du client).
- Le prototype et le wireframe 13 ne sont pas à jour : la colonne « Prochaine relance » arrivera avec S4.2c (D49).

## Dette et à confirmer
- **D70 à D75** (`docs/TECH-DEBT.md`).
- **D32 — à confirmer** : états proposés ; modification seulement en brouillon ; qui enregistre l'acceptation (chargé de compte ou Responsable commercial).

## À valider
1. Les écrans (panneau de la fiche, page Offres, fenêtres de confirmation) et les valeurs par défaut de D32.
2. « Je valide S4.2a » → fusion avec commit de fusion et étiquette `s4-2a-validated`.
