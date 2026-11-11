# Fiche de test — Contrat anti-IDOR

| | |
|---|---|
| **Session** | `idor` |
| **Recette de référence** | [`SPRINT-IDOR-RECETTE.md`](../../SPRINT-IDOR-RECETTE.md) |
| **Étiquette** | `idor-validated` |
| **Contexte** | Branche `sprint/idor-contrat` · 2026-10-22 · test et garde-fou, aucune fonctionnalité nouvelle. |
| **Écrans concernés** | Aucun écran (serveur, conception ou outillage) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi. Elle sert à rejouer la recette utilisateur et à vérifier l'absence de régression.*

## Avant de commencer
- Pile locale lancée (`node scripts/local-stack.mjs --demo`) ou pile jetable ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : chargé de compte, Responsable commercial (avec son équipe), Direction, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | `test/support/idor-registry.ts` | Registre : 8 routes `objet`, 8 routes `admin`, 1 route `portee-tous` | ☐ | |
| 2 | `test/idor-contract.spec.ts` | Sans base : toute route à `:id` est classée ; le registre reste fidèle au code ; les routes `admin` n'ont que des permissions `iam.user.*` détenues par le seul Super administrateur ; les routes `portee-tous` exigent `minScope: 'ALL'` | ☐ | |
| 3 | `test/idor-contract.integration.spec.ts` | Avec base : pour chaque route `objet` et deux attaquants (autre équipe, portée « propres » ou « équipe »), réponse **identique** à celle d'un objet inexistant, aucune fuite, aucune écriture ; contrôle positif du propriétaire | ☐ | |
| 4 | `test/support/route-discovery.ts` | Découverte des routes, partagée avec `route-protection.spec.ts` | ☐ | |
| 5 | `scripts/test-db.mjs` | **Correction** : le script sortait en code 0 même quand des tests échouaient | ☐ | |

## Preuves automatisées relevées à la validation
| Contrôle | Résultat |
|---|---|
| Types, architecture | 0 erreur, 0 violation |
| Tests unitaires | 440 passés (1 ignoré sous Windows) |
| Tests d'intégration | 171 passés sur deux exécutions complètes consécutives ; **une exécution antérieure a eu 1 échec non identifié**, non reproduit |
| Mutants (contrôle d'accès retiré) | Entreprise, session et `minScope` : **tués**. Documents (garde) et résolveur d'entreprise : chacun **survit seul** car les deux couches se redoublent ; **retirés ensemble : tué** |

## Réserves, limites et dette connues
- Les deux couches (résolveur du propriétaire et garde des documents) sont volontairement redondantes : ne pas en retirer une en croyant qu'aucun test ne l'exige.
- Les routes de S4 à S6 devront être classées dans le registre avant d'être fusionnées.
- Hors périmètre : propriété d'un objet côté liste de l'interface, autorisations d'export.

## Rejouer les contrôles automatisés
```bash
pnpm ci                                   # types, architecture, tests unitaires et interface
node apps/api/scripts/test-db.mjs     # tests d'intégration (base PostgreSQL jetable)
```

*Pas de script de mutants versionné pour ce lot.*

## Écarts constatés
| Date | Vérification n° | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
