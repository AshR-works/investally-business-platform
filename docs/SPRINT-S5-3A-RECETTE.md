# S5.3a — recette complète de la clôture de session et des présences aux séances : mutants, Newman, fiches de test

*Branche `feat/s5-3a-recette` · 2026-11-17 · décision D72 ([ADR-0016](adr/0016-cloture-de-session-et-presences-aux-seances.md)), arbitrage [ARBITRAGE-S5-3-SUIVI-PEDAGOGIQUE](cadrages/ARBITRAGE-S5-3-SUIVI-PEDAGOGIQUE.md) (option C, lot a).*

Dernière tranche du lot (a) (après l'API et l'écran). Elle n'ajoute pas de fonction : elle **éprouve** le travail des deux premières.

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Mutants** | `scripts/mutants/s5-3a-cloture-presences.py` : **43 fautes** injectées une à une (domaine, cas d'usage, routes, dépôt, règles de la base, droits des rôles, bibliothèque de l'interface) |
| **Tests ajoutés** | domaine (exclusion des week-ends sur une période qui en traverse un), cas d'usage (motif de réouverture non nettoyé, inscription d'une autre session acceptée à tort), rôles (le formateur ne saisit ni ne lit les présences ; clôturer/rouvrir au catalogue, réservés), intégration (cycle complet clôture/réouverture, feuille de présence dans l'ordre des jours, dernier auteur retenu en base, conflit d'unicité au niveau du dépôt) |
| **Collection Postman** | nouveau parcours **90.6** (14 étapes) : planifier une session, ouvrir, inscrire et confirmer un apprenant, feuille vide, déclarer présent, redéclarer sans changement, statut hors liste refusé, clôturer, clôturer à nouveau refusé, présence refusée pendant la clôture, rouvrir sans motif refusé, rouvrir avec motif, présence de nouveau possible après réouverture |
| **Fiches de test** | session `s5-3a` (14 vérifications) ; fiches d'écran 20 et 23 mises à jour ; index mis à jour |

## Preuves
| Contrôle | Résultat |
|---|---|
| Tests unitaires et d'intégration (API + interface) | **1 516 réussis** API (85 suites, 1 skip sans rapport), **43 fichiers** réussis côté interface — suite complète `pnpm -r test`, sans régression |
| Dont, pour S5.3a | `training-session.spec` (17 scénarios), `session-use-cases.spec` (19 scénarios), `attendance-use-cases.spec`, `roles.spec` (21 scénarios), `sessions-http.integration` (12 cas, dont le cycle complet clôture/réouverture et la feuille de présence) |
| **Mutants** | première passe : **30 tués sur 43**, 13 survivants (`D13`, `U1`, `U3`, `U4`, `R1`, `R2`, `R3`, `P1`, `P2`, `P3`, `P4`, `L1`, `L2`). Après correction des tests et des mutants eux-mêmes, rejoués ciblés : **12 tués sur 13**. Bilan final : **42 tués sur 43 mutants**, 1 survivant expliqué (`R3`, voir Limites connues) |
| **Newman** (pile jetable, démonstration, Super administrateur) | **68 requêtes, 102 assertions, 0 échec**, en 9,4 s, dont le cycle complet du parcours 90.6 (planification, ouverture, inscription confirmée, feuille de présence, saisie, redéclaration, statut refusé, clôture, clôture refusée, présence refusée, réouverture sans motif refusée, réouverture avec motif, présence corrigée) |

## Un défaut trouvé et corrigé en cours de route
`AttendanceView` exposait un champ `version` resté en mémoire d'avant l'enregistrement (jamais relu après la sauvegarde), alors que la présence, comme la présence RH ([ADR-0015](adr/0015-presences-declaratives.md)), n'a volontairement **aucun verrou optimiste** — « la dernière saisie gagne ». Champ retiré de la vue et du mappeur pour rester cohérent avec `PresenceView` ; les tests qui vérifiaient la version le font désormais par lecture directe en base, pas via la réponse de l'API.

## Limites connues
- **`R3` (clôturer et rouvrir exigent la même permission) reste survivant** : aucun rôle actuel ne détient `training.session.close` sans `training.session.reopen` (les deux ne sont accordés qu'ensemble, via le joker `training.*` du Responsable Investudy et du Super administrateur) ; permuter les deux codes de permission entre les deux routes est donc actuellement invisible pour tout test utilisant les rôles réels. Ce n'est pas une lacune de couverture mais une conséquence de la matrice des rôles actuelle — à surveiller si un rôle intermédiaire (clôturer sans rouvrir) était introduit un jour.
- Le week-end D13 n'est démontrable que par un test direct sur `workingDaysBetween` : aucun rythme de session actuellement ouvert (`DAY`, une semaine) ne traverse un week-end dans un parcours réel ; `EVENING` (deux semaines) le traverserait mais n'est pas encore `open`.

## Comment rejouer
1. Mutants : `python scripts/mutants/s5-3a-cloture-presences.py` (**jamais deux exécutions à la fois**, et ne pas toucher à `apps/` pendant la passe). `DRY=1` vérifie seulement les motifs.
2. Newman : pile jetable avec démonstration, environnement copié depuis `docs/api/postman/Investally-local.postman_environment.json` (adresse, e-mail, mot de passe et secret du second facteur **hors du dépôt**), puis `node scripts/api-docs/run-newman.mjs --env <environnement> --only 00,90`.
3. Fiches : `docs/tests/sessions/s5-3a.md`, `docs/tests/interfaces/20-sessions-formation.md`, `docs/tests/interfaces/23-fiche-session.md`.
4. Pile locale : **rebuild : oui** (migration et code de l'API ajoutés) ; **reset : non** (aucune donnée existante affectée).
