# S5.3b — recette complète des évaluations et seuils d'éligibilité : mutants, Newman, fiches de test

*Branche `feat/s5-3b-recette` · 2026-11-23 · décision D75, lot (b) de S5.3 ([ADR-0017](adr/0017-evaluations-et-seuils-d-eligibilite.md)).*

Dernière tranche du lot (b) (après l'API et l'écran). N'ajoute aucune fonction : elle **éprouve** le travail des deux premières. Classé **à risque réel** (D73, D75) : un seuil mal calculé oriente une décision humaine (certificat ou attestation) qui ne revérifie pas le calcul.

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Mutants** | `scripts/mutants/s5-3b-evaluations-et-seuils.py` : **36 fautes** injectées une à une (domaine, cas d'usage, routes, dépôt, règles de la base, droits) |
| **Tests ajoutés** | domaine (`evaluation.spec.ts`, nouveau) et cas d'usage (`evaluation-use-cases.spec.ts`, nouveau) : note hors barème, calcul d'éligibilité, verrou optimiste des seuils ; intégration (`sessions-http.integration.spec.ts`) : inscrit en attente absent de la feuille, droits de lecture/gestion des seuils distincts (Direction), garantie d'unicité des seuils en base |
| **Un défaut trouvé et corrigé** | le rôle Formateur détenait encore `training.evaluation.read`/`.record` (Own) — même hypothèse d'un compte formateur jamais retenue que pour les présences (S1/ADR-0016), oubliée lors du retrait équivalent en S5.3a. Retiré ; `roles.spec.ts` vérifie désormais qu'aucune permission `training.evaluation.*` n'est accordée au Formateur |
| **Parcours Postman 90.7** ajouté (13 étapes) : planifier, ouvrir, inscrire et confirmer, feuille vide, saisir une note, redéclarer sans changement, note hors barème refusée, lire les seuils (valeurs de départ), clôturer, note refusée une fois clôturée, rouvrir avec motif, note de nouveau possible ; **exécutée avec Newman** |
| **Fiche de test** | session `s5-3b` (voir ci-dessous) ; index mis à jour |

## Preuves
| Contrôle | Résultat |
|---|---|
| Tests unitaires et d'intégration (API + interface) | **87 suites** API (dont `evaluation.spec.ts` et `evaluation-use-cases.spec.ts`, nouvelles), **43 fichiers** interface — suite complète `pnpm -r test`, sans régression |
| Intégration HTTP + PostgreSQL (base jetable) | `sessions-http` : **16 cas** (dont le cycle complet évaluation/clôture/réouverture, le calcul d'éligibilité à trois profils, les droits distincts lecture/gestion des seuils, et la garantie d'unicité des seuils en base) |
| **Mutants** | première passe : **28 tués sur 36**, 8 survivants. Après correction des tests (jamais du code) : **7 tués sur 8** rejoués. Bilan final : **35 tués sur 36 mutants**, 1 survivant expliqué (`R3`, voir ci-dessous) |
| **Newman** (pile locale persistante, Super administrateur) | **81 requêtes, 121 assertions, 0 échec**, en 17,4 s, dont le parcours 90.7 (13 étapes) |

## Mutants : les 8 survivants de la première passe, expliqués
Tous corrigés par un test manquant, sauf un (`R3`), qui s'explique par la conception elle-même.

| Mutant | Cause | Correction |
|---|---|---|
| `U7` un retard ne compte plus comme présent (S3) | le test n'utilisait jamais le statut `LATE` | test étendu : un jour `LATE` sur quatre comptabilisé dans le taux |
| `U8` la feuille montre les inscrits non confirmés | aucune assertion sur l'absence d'un inscrit en attente | assertion ajoutée (intégration et, implicitement, le test unitaire `rows).toHaveLength(1)`) |
| `U9` la feuille peut se saisir même clôturée | `canRecord` jamais vérifié à `false` | test dédié : clôture puis réouverture, `canRecord` suivi |
| `U10` les lignes sont triées à l'envers | un seul inscrit dans le test unitaire : aucun ordre à casser | second inscrit ajouté, ordre alphabétique vérifié explicitement |
| `R3` lire et gérer les seuils exigent la même permission | **conception, pas une lacune** : le cas d'usage (`requireManage`, `scopeOf`) revérifie lui-même le droit exact, indépendamment de la permission déclarée sur la route. Muter la seule route ne change donc rien à l'issue observable — une double vérification, pas un trou | aucune (documenté) |
| `P4` une version périmée des seuils s'enregistre quand même | le cas d'usage vérifie déjà la version avant d'appeler le dépôt : le test par HTTP n'atteint jamais le verrou du dépôt lui-même | test direct sur le dépôt (`TrainingThresholdsRepository.save`), contournant le cas d'usage |
| `G4` plusieurs lignes de seuils sont permises | aucun test n'essayait d'insérer une seconde ligne | test direct : `INSERT ... VALUES (2, ...)` refusé |
| `L2` l'action « gérer les seuils » disparaît du catalogue | aucune assertion sur le catalogue des permissions pour cette action | assertion ajoutée à `roles.spec.ts` |

## Limites connues
- Le survivant `R3` est documenté, pas corrigé : le comportement observable reste correct (double vérification), seule la mutation de la route seule est indétectable par un test HTTP de surface.
- Pas de nouvelle dette : celle du lot (a) (conservation des données, D11/D65/S10) couvre aussi les notes.

## Comment rejouer
1. Mutants : `python scripts/mutants/s5-3b-evaluations-et-seuils.py` (**jamais deux exécutions à la fois**, et ne pas toucher à `apps/` pendant la passe). `DRY=1` vérifie seulement les motifs.
2. Newman : pile locale (`node scripts/local-stack.mjs --seed=demo --rebuild` ou équivalent), environnement copié depuis `docs/api/postman/Investally-local.postman_environment.json` (adresse, e-mail, mot de passe et secret du second facteur **hors du dépôt**), puis `node scripts/api-docs/run-newman.mjs --env <environnement> --only 00,90`.
3. Fiche : `docs/tests/sessions/s5-3b.md`.
4. Pile locale : **rebuild : non** (aucun code ni migration ajoutés dans cette tranche, seulement des tests et de la documentation) ; **reset : non**.
