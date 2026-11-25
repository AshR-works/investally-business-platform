# Arbitrage — architecture de la restructuration (intranet, quatre métiers séparés)

*2026-11-25 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). **Aucun code n'est écrit** tant que la décision n'est pas prise. Les notes de la grille sont des jugements de l'équipe technique, à contester. Cet arbitrage doit être lu avec [ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md), qui le **rouvre en partie**.*

## 1. La question
Quelle architecture donner à la restructuration demandée par la Direction générale après la démonstration du 2026-11-25 : une application proche d'un **intranet**, avec des **applications accessibles à des adresses différentes** ? *Précision de la Direction produit : le DG a envisagé des applications à des adresses différentes ; la notion de « métiers séparés » est la conclusion que la Direction produit en a tirée, pas une formulation du DG.*

Quatre métiers prioritaires :
- **CRM**, qui absorbe Investudy ; ses menus multiples laissent place à une entrée qui condense les choix prioritaires.
- **RH** : organigramme, absences (demandes et absences des employés), demandes de formation des employés.
- **Assets Management** : gestion logistique (ordinateurs, écrans, etc.) avec toutes les informations liées.
- **Finances** : gestion comptable complète, conforme aux réglementations OHADA, CEMAC et COSUMAF.

L'état actuel est conservé et archivé sous le nom « Investally BP - Beta » (étiquette Git `investally-bp-beta`, commit `36c3cf1`) : la restructuration part de là, sur de nouvelles branches.

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| Un monolithe NestJS en couches (domaine, application, infrastructure, présentation), contrôlé par `pnpm arch` | ARCHITECTURE |
| Un schéma PostgreSQL par module (`bd`, `training`, `hr`, `iam`, `audit`, `docs`), sans clé étrangère entre schémas | D161 |
| Un seul Next.js, un seul compte, droits par rôle et par portée (Propre, Équipe, Tous) | RBAC |
| Hébergement : serveur virtuel avec Docker Compose | D63 |
| Développeur seul ; le patron d'échange entre modules et le système de notifications entre utilisateurs ont été **reportés** | Décision du 2026-11-24 |
| Le menu compte sept domaines (CRM, Investudy, Finance, RH, Stocks, Reporting, Administration) | D51 |
| Hypothèse de départ : « séparés » veut dire séparés pour les droits et la navigation, pas déployés séparément | **Probablement fausse** : le DG a envisagé des applications à des adresses différentes — voir l'arbitrage d'adressage |

## 3. Options
| | Principe | Réversibilité |
|---|---|---|
| **A. Statu quo étendu** | Même monolithe ; on ajoute `assets` et `finance`, on regroupe la navigation | Totale |
| **B. Monolithe modulaire strict** | A, plus des frontières imposées : chaque métier n'expose qu'une interface publique, communication par événements internes, un espace par métier dans un seul Next.js | Bonne |
| **C. Services par métier** | Une API par métier, une passerelle, un service d'identité central | Faible |
| **D. B avec Finances isolée dès la conception** | B, et Finances dans son propre schéma et son rôle SQL, journal comptable en ajout seul, joignable seulement par son interface publique, prête à être extraite | Bonne |

## 4. Grille (poids de 1 à 5, notes de 1 à 5, maximum 100)
| Critère (poids) | A | B | C | D |
|---|---|---|---|---|
| Charge et délai pour un développeur seul (5) | 5 | 4 | 1 | 3 |
| Réemploi de l'existant (4) | 5 | 4 | 2 | 4 |
| Isolation des métiers et des droits (4) | 2 | 4 | 5 | 5 |
| Conformité et traçabilité des Finances (4) | 3 | 4 | 4 | 5 |
| Évolutivité, extraction possible (3) | 2 | 4 | 5 | 5 |
| **Total** | **71** | **80** | **64** | **86** |

Totaux recalculés : A = 25 + 20 + 8 + 12 + 6 ; B = 20 + 16 + 16 + 16 + 12 ; C = 5 + 8 + 20 + 16 + 15 ; D = 15 + 16 + 20 + 20 + 15. L'écart entre D et B tient surtout au critère Finances ; en abaissant ce poids à 2, D reste devant (76 contre 72).

## 5. Risques et dette de D
- **Conformité :** l'équipe technique construit la structure comptable, elle ne certifie pas la conformité OHADA, CEMAC ou COSUMAF. Un expert-comptable ou un juriste doit valider.
- **Travail en amont :** le contrat de communication entre métiers doit être décidé maintenant (un bien Assets est affecté à un employé RH, Finances lit les commissions du CRM ; les demandes de formation des employés visent des formations **externes** et restent dans RH, sans lien avec l'ancien Investudy — ce qu'elles déclenchent côté Finances, budget ou paiement, reste à préciser). C'est le point reporté le 2026-11-24 ; il devient bloquant.
- **Charge :** D coûte un peu plus que B au départ ; Finances étant le dernier métier à construire, ce surcoût n'arrive pas tout de suite.
- **Limite de cet arbitrage :** aucune de ces options, prise seule, ne respecte l'exigence du DG de ne pas exposer les applications les unes aux autres. Voir [l'arbitrage d'adressage](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md).

## 6. Recommandation
**Option D.** Meilleure note, et seule à traiter le point le plus risqué (la conformité comptable) sans multiplier les déploiements. **B** est le repli pour alléger le départ : Finances s'y isole plus tard, au prix d'une reprise.

À relire après la décision d'adressage : si le DG veut des applications réellement fermées les unes aux autres, la structure retenue ici devient le **code commun** de plusieurs déploiements (même dépôt, mêmes bibliothèques, déploiements séparés).

## 7. Décision attendue
**Réponse courte** : « D », « B » ou « A ».

Sous-décisions :
1. **Un seul Next.js** avec un espace par métier (recommandé), ou plusieurs interfaces ?
2. **Socle commun inchangé** : comptes, droits, audit, documents, futur système de notifications.
3. **Schémas de base** : on garde `bd`, `training` et `hr` ; on regroupe `training` sous le CRM dans le code et l'interface seulement.
4. **Reconstruction** : même dépôt, nouvelles branches parties de `investally-bp-beta` (recommandé), ou nouveau dépôt ?
5. **Contrat entre métiers** : on le tranche avec cette architecture (recommandé), ou on le repousse encore ?

Après la réponse : consignation au registre des décisions, ADR si l'architecture change, puis seulement exécution.
