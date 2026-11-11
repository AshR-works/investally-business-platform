# RH-3d — recette complète des contrats et des parcours : mutants, Newman, fiches de test

*Branche `feat/rh-3d-recette` (sur la branche de RH-3c) · 2026-11-12 · décisions D67 et D68 ([ADR-0013](adr/0013-contrats-du-personnel-sans-donnees-sensibles.md), [ADR-0014](adr/0014-parcours-d-integration-et-de-depart.md)).*

Dernière tranche de RH-3 (après 3a et 3b, l'API, et 3c, les écrans). Elle n'ajoute pas de fonction : elle **éprouve** le travail des trois premières.

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Mutants** | `scripts/mutants/rh3-contrats-parcours.py` : **163 fautes** injectées une à une (domaine, cas d'usage, routes et lecture en base, règles de la base, droits des rôles, règles de saisie de l'interface, menu et droits des écrans) ; un mutant équivalent retiré et documenté |
| **Tests ajoutés pour les survivants** | 13 cas : fin effective anticipée, droit de gérer en portée réduite (contrats et parcours), échéance « aujourd'hui », contrat terminé absent des échéances, filtres d'état et de nature, ordre des listes, conflits au niveau des dépôts, bornes acceptées côté interface |
| **Collection Postman** | nouveau parcours **90.4** (15 étapes) : types de contrat, contrat à durée déterminée, second contrat refusé, prolonger, terminer (motif de la liste, motif hors liste refusé), échéances, modèles, lancer un parcours (second refusé), cocher, décocher, annuler (parcours annulé refusé) ; **exécutée avec Newman** |
| **Fiches de test** | session `rh-3` (15 vérifications) et cinq fiches d'écran (34 à 38), index mis à jour |
| **Un défaut trouvé et corrigé** | sur l'écran des modèles, l'erreur d'une ligne était affichée mais **non reliée à son champ** pour un lecteur d'écran ; identifiant et `aria-describedby` ajoutés (test de structure) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | `tsc` propre (API et interface) ; `pnpm arch` : 332 modules, aucune violation |
| Tests unitaires de l'API | **1 449 réussis** (80 suites) |
| Tests de l'interface | **815 réussis** (42 fichiers) |
| Intégration (base jetable) | `hr-contracts-http`, `hr-journeys-http`, `hr-leave-http`, `hr-employees-http`, `idor-contract`, `core-schema`, `rbac-http`, `seed-demo` : **228 réussis, 9 suites**. Un premier passage a échoué sur le contrat anti-IDOR : un de mes nouveaux tests changeait la version du modèle de départ dont dépend la sonde ; le test remet maintenant la version de départ (les deux suites rejouées : 132 réussis) |
| **Mutants** | première passe : **148 tués sur 163**, 15 survivants. Trois cas : **13 vrais survivants** (tests ajoutés, tous tués au second passage) ; **W14** : faute de mon lanceur (une faute qui empêche la compilation était comptée comme survivante : corrigé, W14 tué) ; **R11** : équivalent (le tri des tâches en mémoire double l'ordre que la base rend déjà par son index ; retiré). Bilan : **162 tués sur 162 mutants valides** |
| **Newman** (pile jetable, démonstration, Super administrateur) | **424 requêtes, 1 584 assertions, 0 échec**, en 52 secondes, dont les 17 routes de contrats et de parcours (avec et sans jeton) et le parcours 90.4 (41 requêtes avec la connexion, 65 assertions, 0 échec) |
| Accessibilité (contrôle du DOM dans le navigateur) | écrans **Contrats** (et sa fenêtre : champs nommés, erreurs reliées aux champs, focus dans la fenêtre), **Parcours**, **Un parcours** (cases nommées, barre d'avancement annoncée) et **Modèles** (33 champs et 33 boutons d'icône nommés) : un titre de niveau 1, pas de saut de niveau, aucun identifiant en double ; seul défaut : les erreurs des modèles (corrigé) |

## Limites connues
- **axe-core non rejoué** : le navigateur de la plateforme refuse l'injection du script (politique de sécurité du contenu), et le script `a11y-audit.mjs` exige un environnement dédié (D160). Le contrôle fait ici est un contrôle du DOM, **pas** un audit axe ni un passage au lecteur d'écran.
- **Non vérifié** : écran « Contrats à échéance » (contrôle du DOM), contrastes, mode sombre, 1280 px, navigation au clavier, lecteur d'écran.
- Le correctif d'accessibilité des modèles est vérifié par un test de structure, **pas rejoué dans le navigateur** (la pile jetable était déjà arrêtée).
- Les dossiers 00b et 98 de la collection ne sont pas rejoués (ils ferment la session ou enrôlent un compte).
- **Dettes ouvertes** : D179 à D184 (voir [TECH-DEBT](TECH-DEBT.md)).

## Comment rejouer
1. Mutants : `python scripts/mutants/rh3-contrats-parcours.py` (environ 1 h 30 ; `DRY=1` vérifie seulement les motifs ; **jamais deux exécutions à la fois**, et ne pas toucher à `apps/` pendant la passe).
2. Newman : pile jetable avec démonstration, environnement copié depuis `docs/api/postman/Investally-local.postman_environment.json` (adresse, e-mail, mot de passe et secret du second facteur **hors du dépôt**), puis `node scripts/api-docs/run-newman.mjs --env <environnement> --only 00,90`.
3. Fiches : `docs/tests/sessions/rh-3.md` et `docs/tests/interfaces/34` à `38`.
