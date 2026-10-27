# Contrat anti-IDOR : recette

*Branche `sprint/idor-contrat` · 2026-10-22 · test et garde-fou, aucune fonctionnalité nouvelle.*

## Constat de départ
Relecture de toutes les routes qui désignent un objet : **aucune exposition à l'IDOR** sur le code actuel. Le risque restant était l'oubli sur une route future (le contrôle dépend de chaque cas d'usage). Ce lot le rend détectable par la CI.

## Livré
| Élément | Rôle |
|---|---|
| `test/support/idor-registry.ts` | Registre : 8 routes `objet`, 8 routes `admin`, 1 route `portee-tous` |
| `test/idor-contract.spec.ts` | Sans base : toute route à `:id` est classée ; le registre reste fidèle au code ; les routes `admin` n'ont que des permissions `iam.user.*` détenues par le seul Super administrateur ; les routes `portee-tous` exigent `minScope: 'ALL'` |
| `test/idor-contract.integration.spec.ts` | Avec base : pour chaque route `objet` et deux attaquants (autre équipe, portée « propres » ou « équipe »), réponse **identique** à celle d'un objet inexistant, aucune fuite, aucune écriture ; contrôle positif du propriétaire |
| `test/support/route-discovery.ts` | Découverte des routes, partagée avec `route-protection.spec.ts` |
| `scripts/test-db.mjs` | **Correction** : le script sortait en code 0 même quand des tests échouaient |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types, architecture | 0 erreur, 0 violation |
| Tests unitaires | 440 passés (1 ignoré sous Windows) |
| Tests d'intégration | 171 passés sur deux exécutions complètes consécutives ; **une exécution antérieure a eu 1 échec non identifié**, non reproduit |
| Mutants (contrôle d'accès retiré) | Entreprise, session et `minScope` : **tués**. Documents (garde) et résolveur d'entreprise : chacun **survit seul** car les deux couches se redoublent ; **retirés ensemble : tué** |

## À savoir
- Les deux couches (résolveur du propriétaire et garde des documents) sont volontairement redondantes : ne pas en retirer une en croyant qu'aucun test ne l'exige.
- Les routes de S4 à S6 devront être classées dans le registre avant d'être fusionnées.
- Hors périmètre : propriété d'un objet côté liste de l'interface, autorisations d'export.

## À valider
« Je valide » → fusion `--no-ff` dans `main` et étiquette `idor-validated`.
