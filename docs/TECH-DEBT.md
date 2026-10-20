# Dette technique et conventions

## Smell Inventory
| # | Smell | Où | Décision | Statut |
|---|---|---|---|---|
| D1 | Risque de *classitis* : une classe par commande/requête/DTO/mapper/port pour des CRUD triviaux | Tous modules | Pour les contextes **supporting/generic** (HR, Tax, Documents), un use case peut regrouper des opérations CRUD d'un même agrégat ; les use cases séparés sont réservés au Core et aux flux à règles | Adopté |
| D2 | Fuite d'information : une même règle (ex. transitions d'état d'`Opportunity`) répétée en validation DTO, use case et SQL | BD, Training | La règle vit **une seule fois dans l'agrégat** ; le DTO ne valide que le format ; la base ne garde que des contraintes d'intégrité | Adopté |
| D3 | Mapping Domain ↔ Prisma répétitif | Infrastructure | Dette acceptée (ADR-0003) ; gabarit de module + tests de mappers en S1 | Acceptée |
| D4 | Duplication volontaire de données entre contextes (événements avec données copiées) | BD→Training→Finance | Dette acceptée ; contrats d'événements versionnés | Acceptée |
| D5 | Hypothèses de charge et de périmètre non confirmées | Phase 3 | Revue à la fin de S1 avec les chiffres réels | Ouverte |

## Adopted Conventions
- **Nommage** : vocabulaire du glossaire (`docs/ARCHITECTURE.md`) dans le code, les tests et l'API. Code en anglais, libellés UI en français. Un terme du glossaire = un seul nom de code.
- **Où vit le comportement** : dans les entités/agrégats (`opportunity.advanceTo(stage)`), pas dans des `*Manager`/`*Helper`.
- **Un module = une interface publique** (`index.ts`) ; tout le reste est interne.
- **Erreurs** : le Domain lève des erreurs métier typées ; la Presentation les traduit en réponses HTTP (RFC 7807 `application/problem+json`).
- **Pas de décorateur de framework** dans `domain/`. Validation d'entrée dans les DTO de `presentation/`.
- **Commandes vs requêtes** : une commande modifie l'état via un agrégat ; une requête retourne un read model et peut lire la base directement via un port de lecture dans `infrastructure/`.
- **Temps et identifiants** injectés (`Clock`, `IdGenerator`) pour des tests déterministes.
- **Pas d'abstraction spéculative** : une interface ne se crée que pour une frontière réelle (persistance, service externe, autre contexte).
- **Dette tracée** : tout raccourci est ajouté à ce tableau avec un propriétaire.
