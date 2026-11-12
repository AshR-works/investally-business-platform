# RH-4c — recette complète des présences déclaratives : mutants, Newman, fiches de test

*Branche `feat/rh-4c-recette` · 2026-11-12 · décision D69 ([ADR-0015](adr/0015-presences-declaratives.md)).*

Dernière tranche de RH-4 (après 4a, l'API, et 4b, l'écran). Elle n'ajoute pas de fonction : elle **éprouve** le travail des deux premières.

## Ce qui est livré
| Livrable | Contenu |
|---|---|
| **Mutants** | `scripts/mutants/rh4-presences.py` : **97 fautes** injectées une à une (domaine, cas d'usage, routes, dépôt, règles de la base, droits des rôles, règles de saisie de l'interface, menu et droits des écrans) ; 1 retirée (code mort supprimé) |
| **Tests ajoutés** | 1 cas d'usage (retrait d'une présence restée après le départ d'un employé archivé) et 2 cas d'intégration (persistance : jours lus dans l'ordre, retrait d'un seul jour, dernier mode et dernier auteur gardés en base ; conflit d'unicité au niveau du dépôt) |
| **Collection Postman** | nouveau parcours **90.5** (14 étapes) : employé de test, tableau du jour, déclarer (la RH saisit, ni heure ni lieu dans la réponse), redéclarer sans changement, changer de mode, mode hors liste refusé, heure refusée, jour trop ancien refusé, employé inexistant « introuvable », tableau avec la déclaration, retirer, retirer une absente « introuvable », période de plus de 93 jours refusée ; **exécutée avec Newman** |
| **Fiches de test** | session `rh-4` (14 vérifications) et fiche d'écran 39 (13 scénarios) ; index mis à jour |
| **Un défaut trouvé et corrigé** | un contrôle inutile (jour après la date de départ) : un employé qui a une date de départ est toujours archivé, et déclarer pour un archivé est refusé avant. Code mort supprimé ; le retrait d'une présence restée après un départ reste permis (la RH nettoie), avec son test |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | `tsc` propre (API et interface) ; `pnpm arch` : aucune violation |
| Tests unitaires de l'API | **1 495 réussis** (82 suites) |
| Tests de l'interface | **841 réussis** (43 fichiers) |
| Intégration (base jetable) | `hr-presences-http` (14 cas), contrat anti-IDOR, droits : **133 réussis** (3 suites) ; `seed-demo` : 10 réussis |
| **Mutants** | première passe : **96 tués sur 97**, 1 survivant. **U11** (« un jour après le départ est accepté ») : code mort, un employé qui a une date de départ est archivé, donc le contrôle n'est jamais atteint ; supprimé et retiré de la liste. Les six mutants voisins (fenêtres, entrée, archivé) rejoués après la suppression : tués. Bilan : **96 tués sur 96 mutants valides** |
| **Newman** (pile jetable, démonstration, Super administrateur) | **443 requêtes, 1 626 assertions, 0 échec**, en 49 secondes, dont les trois routes des présences (avec et sans jeton) et le parcours 90.5 (14 étapes) |
| Navigateur (RH-4b) | écran parcouru en Super administrateur : affichage, saisie, changement de mode ; trois défauts corrigés (week-end au milieu d'une absence, totaux, libellé « vous ») |

## Limites connues
- **Profils employé et responsable non parcourus dans le navigateur** : leur portée (sa ligne, ses subordonnés directs) n'est vérifiée que par l'API (tests d'intégration), la logique de l'écran (tests) et les mutants.
- **Les trois corrections de l'écran** (RH-4b) n'ont pas été revues dans le navigateur (la pile n'a pas été reconstruite) ; elles sont couvertes par des tests.
- **axe-core non rejoué** (D160) ; **non vérifié** : mode sombre, 1280 px, navigation au clavier, lecteur d'écran, contrastes des symboles.
- Un premier passage des tests unitaires de l'API a montré 3 échecs pendant que la machine était saturée par d'autres exécutions ; rejoués seuls : 1 495 réussis. Même cause que pour les tests lents de l'interface (délais), pas un défaut du code.
- Les dossiers 00b et 98 de la collection ne sont pas rejoués (ils ferment la session ou enrôlent un compte).
- **Dettes ouvertes** : D185 à D189 (voir [TECH-DEBT](TECH-DEBT.md)), dont la durée de conservation des présences (D189).

## Comment rejouer
1. Mutants : `python scripts/mutants/rh4-presences.py` (environ 1 h 30 sur une machine chargée ; `DRY=1` vérifie seulement les motifs ; **jamais deux exécutions à la fois**, et ne pas toucher à `apps/` pendant la passe).
2. Newman : pile jetable avec démonstration, environnement copié depuis `docs/api/postman/Investally-local.postman_environment.json` (adresse, e-mail, mot de passe et secret du second facteur **hors du dépôt**), puis `node scripts/api-docs/run-newman.mjs --env <environnement> --only 00,90`. Un code du second facteur ne vaut qu'une fois par période de 30 secondes : attendre entre deux exécutions.
3. Fiches : `docs/tests/sessions/rh-4.md` et `docs/tests/interfaces/39-presences.md`.
4. Pile locale : **rebuild : oui** (le code de l'API a changé, une ligne retirée) ; **reset : non**.
