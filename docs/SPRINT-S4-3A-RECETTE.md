# S4.3a — opportunités : le pipeline commercial : recette

*Branche `sprint/s4-3-opportunites` (partie de `main`) · 2026-11-05 · cas d'usage CU-C-04 (opportunités) ; flux C4 ; DDR-0021 ; décision D36. Première moitié de la session S4.3 ; S4.3b (statuts d'entreprise, réattribution, fiche 360°) n'est pas livrée.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Page « Opportunités »** | Module du hub livré : pipeline en **cartes** (lignes de six) ou en **colonnes par étape** (bascule), filtres Ouvertes / Gagnées / Perdues / Toutes, recherche par intitulé, total des montants annoncé |
| **Créer** | Entreprise, intitulé, montant, devise, source ; depuis la fiche d'une entreprise, bouton « Nouvelle opportunité » avec l'entreprise imposée |
| **Étapes** | Cinq étapes, **une à la fois**, sans retour en arrière ; l'**accord de principe exige un rendez-vous décideur tenu** (agenda S4.2d) |
| **Dérogation** | Le Responsable commercial peut lever cette règle avec une **justification obligatoire** ; la carte porte le badge « Dérogation » |
| **Clore** | **Perdue** avec motif de la liste fermée (chargé de compte pour les siennes) ; **gagnée** par le Responsable commercial seulement, après l'accord de principe ; une opportunité close n'est jamais supprimée ni rouverte |
| **Droits et audit** | Chargé de compte (Propre), Responsable commercial (Équipe), Direction en lecture ; la visibilité suit celle de l'entreprise ; création, modification, avancement, dérogation et clôture tracées avec la session ; nouvelles permissions `advance`, `close_lost`, `close_won`, `override` |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation (213 modules) |
| Tests unitaires de l'API | **780 réussis**, 0 échec (les suites d'intégration, qui exigent la base, sont ignorées dans cette passe) ; dont 50 nouveaux (domaine : 34 ; cas d'usage : 16) |
| **Tests d'intégration (PostgreSQL jetable)** | **306 / 306** (21 suites) ; 12 nouveaux de bout en bout (cycle, accord de principe refusé puis accepté, dérogation, clôtures, portée et droits, règles de la base, verrou optimiste, audit) et les sondes IDOR |
| **IDOR** | Les routes des opportunités sont classées « objet » et sondées : même réponse pour l'opportunité d'un collègue et pour un identifiant inexistant, aucune écriture |
| Tests de l'interface | **390 / 390** (33 nouveaux) : actions selon l'état et les droits, regroupement par étape, montants, paramètres de liste, libellés |
| **Mutants** | **24 / 24 tués** |
| **Navigateur réel (Edge + axe-core)** | Parcours limité aux offres, relances, agenda et opportunités : **105 contrôles réussis, aucun échec** (le seul ✘ est l'arrêt volontaire de fin de parcours), dont les huit écrans des opportunités : pipeline vide, champs non conformes, cartes, accord de principe refusé, dérogation sans justification, vue par étape, clôture perdue sans motif, opportunité perdue ; résultats `docs/accessibilite/resultats/axe-2026-11-05-s43a.json`, captures `docs/accessibilite/s43a-captures/` |

## Défauts trouvés par la recette et corrigés
- **Ordre des titres** (axe, première exécution) : la vue par étape utilisait des titres de niveau 3 sans niveau 2 ; passés en niveau 2.
- **Réponse périmée** : changer de filtre pendant un chargement pouvait laisser une réponse plus ancienne remplacer l'affichage ; seule la dernière demande est prise en compte.
- **Mesures d'audit fragiles** (hors application) : attente fixe remplacée par une attente de condition dans le bloc des contacts ; trois exécutions ont échoué par instabilité du navigateur sans fenêtre.

## Réserves sur la recette
- **Parcours navigateur limité** : les écrans des lots antérieurs situés après l'agenda ne sont pas revérifiés. Le navigateur sans fenêtre de la machine reste instable (deux décrochages sur ce lot, relancés).
- **Capture manquante** : la vue par étape et les cartes n'ont pas de capture (contrôles réussis) ; quatre captures sont fournies.
- **S4.3b non livrée** : statuts d'entreprise (CU-C-05), réattribution du propriétaire (D17), fiche 360°, colonnes Responsable et Valeur, lien rendez-vous ↔ opportunité (D93).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22.

## Dette et à confirmer
- **D93 à D99** (`docs/TECH-DEBT.md`).
- **D36 — à confirmer** : étapes, absence de retour en arrière, motifs de perte, pas de réouverture.

## À valider
1. Les écrans (pipeline en cartes et par étape, création, avancement, dérogation, clôtures) et les valeurs par défaut de D36.
2. « Je valide S4.3a » → fusion avec commit de fusion et étiquette `s4-3a-validated`.
