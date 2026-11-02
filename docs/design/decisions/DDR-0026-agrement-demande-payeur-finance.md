# DDR-0026 — Agrément : état « demandé », payeur tiers, constat du paiement par la Finance, second facteur à la réattribution

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-09 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.4a-bis ; décisions D41 (réponses FD-3, FD-4, FD-6) et D42 (valeurs par défaut) ; DDR-0024 (agréments) ; DDR-0022 (statuts et responsable) |

## Contexte
Les réponses de la Direction produit à la feuille de décision (D41) corrigent trois points de lots déjà validés : **FD-3 B** (un tiers peut payer l'agrément), **FD-4 B** (le DAF constate le paiement ; un agrément peut d'abord n'être que « demandé »), **FD-6 B** (changer le responsable d'une entreprise exige un second facteur récent). Ces corrections précèdent S4.4c (commissions à verser), qui s'appuie sur l'agrément « honoré » par le DAF.

## Décisions
1. **État « demandé »** : premier état d'un agrément, avant « reçu ». Une demande **n'a ni date de réception ni document signé obligatoire** et **ne rend pas l'entreprise « Cliente »**. Elle **occupe l'opportunité** (un seul agrément actif par opportunité). Elle **se déclare reçue** (date de la signature, non future et antérieure à la fin de validité) : l'entreprise devient alors « Cliente » et l'événement « agrément accordé » est émis ; ou elle **s'annule** avec un motif. Elle ne s'honore ni ne s'expire.
2. **Enregistrer directement « reçu »** reste possible (parcours de S4.4a inchangé) : la case « la promesse n'est pas encore signée » choisit la demande.
3. **Payeur** : le client par défaut ; un **tiers** se renseigne par son **nom** et son **type** (employeur, organisme, bailleur), **les deux ensemble**. Ils se fixent à la création ; pas de fiche du tiers.
4. **Constat du paiement par la Finance** : le droit `bd.approval.honor` passe du Responsable commercial à la **Finance (le DAF)**, qui reçoit aussi la **lecture** des agréments (portée Tous). Le Responsable commercial garde créer et annuler ; **créer et déclarer reçu** relèvent du même droit de création.
5. **Réattribution d'une entreprise** : la route exige un **second facteur récent** (moins de 10 minutes, comme les autres actions sensibles), en plus de la confirmation par case à cocher ; l'interface redemande un code et rejoue la requête.

## Mesures de rigueur
- La base garantit : nom et type de payeur ensemble, nom non vide ; date de réception absente seulement pour une demande ou un agrément annulé avant réception ; clôture cohérente avec les quatre états ; un seul agrément actif (demandé, reçu ou honoré) par opportunité ; fin de validité jamais avant la réception.
- La valeur d'état « demandé » est ajoutée dans une migration à part : elle ne peut servir qu'après validation de la transaction qui l'ajoute.
- 23 fautes injectées (domaine, cas d'usage, droits, routes, dépôt, migration) sont toutes détectées ; le contrat anti-IDOR couvre la nouvelle route « objet » (réception) et le constat par la Finance.
- Les mêmes règles de saisie sont comparées entre l'interface et le **domaine réel** du serveur (y compris le payeur).

## Conséquences
- Réversible : deux migrations, un cas d'usage, une route, trois composants modifiés.
- **Dette** : D125 à D129 (`docs/TECH-DEBT.md`) ; D111 et D112 sont soldées ou précisées.
- Les droits de la Finance dans le CRM (D8) s'élargissent d'un cran : lecture des agréments et constat du paiement. Les commissions (S4.4c) ajouteront le déblocage.
- Le prototype et les wireframes ne montrent ni l'état « demandé » ni le payeur (D49).
