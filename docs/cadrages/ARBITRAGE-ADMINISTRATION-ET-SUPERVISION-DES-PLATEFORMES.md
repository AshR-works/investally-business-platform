# Arbitrage — administration et supervision transverses des plateformes

*2026-11-25 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). **Aucun code n'est écrit** tant que la décision n'est pas prise. Les notes de la grille sont des jugements de l'équipe technique, à contester. À lire avec [ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md) et [ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS](ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS.md), toujours en attente de décision.*

## 1. La question
La personne chargée de superviser les quatre plateformes (CRM avec Investudy, RH, Finances, Assets Management) doit pouvoir **s'assurer que tout se passe bien pendant que les agents travaillent**. Faut-il pour cela un **Super administrateur unique et centralisé**, ou **individualiser** la gestion de chaque plateforme ?

Deux notions sont à distinguer :
- **Administrer** : créer les comptes, attribuer les accès, régler les paramètres. C'est une écriture.
- **Superviser** : observer que les plateformes tournent, qui est connecté, s'il y a des erreurs. C'est une lecture, qui n'exige ni droit d'écriture ni lecture des données métier.

Exigence ferme du DG : les applications ne doivent pas être exposées les unes aux autres. Un compte qui les ouvre toutes est donc une question d'architecture, pas seulement de confort.

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| Le rôle Super administrateur a tous les droits : comptes, audit, documents, CRM, RH, Investudy, reporting ; second facteur obligatoire, toutes les actions auditées, ne peut pas modifier ses propres rôles | Matrice des rôles |
| Il faut au moins **deux** Super administrateurs nominatifs, sans compte partagé ; un seul compte au départ : risque de blocage | D10, R13 |
| La Direction lit tout (dont le journal d'audit) et n'écrit pas | Matrice des rôles |
| Écrans d'administration existants : utilisateurs, droits (lecture seule), exports (utilisateurs, droits, sessions en CSV), sessions et connexions de chacun | État actuel |
| Le module « Sécurité » (journal d'audit et alertes) est prévu mais pas construit | Reste à faire |
| Le **suivi des performances** n'est autorisé qu'après un avis juridique et RH | DEC-006 |
| Les données sensibles RH (salaire, paie, date de naissance, adresse personnelle) sont exclues de l'application | D55 à D58, D60 |
| Les plateformes seront isolées, avec une identité centrale (connexion commune) | Arbitrages d'adressage et de parcours d'entrée |
| Développeur seul | — |

## 3. Options
| | Principe | Respecte l'exigence du DG ? |
|---|---|---|
| **A. Statu quo** | Un Super administrateur global sur les quatre plateformes, tout-en-un | **Non** : un seul compte ouvre tout |
| **B. Individualiser entièrement** | Un administrateur par plateforme, aucun compte transverse, pas de vue d'ensemble | **Oui** |
| **C. Séparer les fonctions** | Un **administrateur d'identité** (comptes, accès aux plateformes), un **superviseur** (lecture seule transverse : connexions, sessions, erreurs, état, journal d'audit **sans le contenu des données**), un **administrateur par plateforme** (paramètres et référentiels), un **compte de secours** réservé | **Oui, pour l'essentiel** : aucun compte ne lit les données métier de toutes les plateformes |
| **D. C avec supervision fonctionnelle** | C, et le superviseur voit aussi l'activité des agents et leurs données | **En partie** : il expose le contenu de chaque plateforme à un seul compte |

## 4. Grille (poids de 1 à 5, maximum 105)
| Critère (poids) | A | B | C | D |
|---|---|---|---|---|
| Respect de l'exigence de non-exposition (5) | 1 | 5 | 4 | 3 |
| Capacité à superviser : voir que tout se passe bien (5) | 4 | 1 | 4 | 5 |
| Charge et délai pour un développeur seul (4) | 5 | 3 | 3 | 2 |
| Protection des données sensibles (RH, finances) et conformité (4) | 1 | 5 | 4 | 2 |
| Résilience : pas de compte unique, pas de blocage si une personne manque (3) | 2 | 4 | 4 | 4 |
| **Total** | **55** | **74** | **80** | **68** |

Totaux recalculés : A = 5 + 20 + 20 + 4 + 6 ; B = 25 + 5 + 12 + 20 + 12 ; C = 20 + 20 + 12 + 16 + 12 ; D = 15 + 25 + 8 + 8 + 12. La grille et l'exigence ferme du DG donnent le même classement : A est dernière et échoue à l'exigence.

## 5. Risques et dette
- **Le compte d'identité reste très puissant** : il crée les comptes et attribue les accès. Garde-fous : il ne peut pas modifier ses propres accès (règle déjà vraie pour le Super administrateur), un **second administrateur d'identité nominatif** (D10), et un journal d'audit que ce compte ne peut pas effacer.
- **Cumul de rôles par une même personne** : si la même personne tient l'administration d'identité et la supervision, lui donner **deux comptes distincts**, pour qu'une session de supervision ne puisse pas modifier un accès.
- **Compte de secours** : second facteur, usage exceptionnel, alerte à chaque utilisation, détenteur nommé.
- **Supervision sans fuite de données** : les erreurs et journaux visibles du superviseur ne doivent contenir ni donnée personnelle ni donnée comptable ; un masquage est à prévoir.
- **Console à construire** : le module Sécurité prévu (journal d'audit et alertes) en est la base ; c'est du travail, pas seulement de la configuration.
- **Redécoupage des rôles** : le rôle Super administrateur actuel se découpe en plusieurs rôles ; les écrans d'administration doivent suivre.
- **D (supervision fonctionnelle)** : bloquée par l'avis juridique et RH (DEC-006) ; à ne pas construire avant.
- **Dépend des arbitrages d'adressage et de parcours d'entrée** : l'identité centrale est le lieu naturel de l'administration d'identité.

## 6. Recommandation
**Option C.** Elle donne la vue d'ensemble demandée (savoir que tout va bien) sans réunir toutes les clés dans un seul compte, et elle respecte l'exigence du DG. La supervision commence **technique** ; D reste une extension possible, à n'ouvrir qu'après l'avis juridique et RH.

B est le repli si le DG refuse toute vue transverse : plus protecteur, mais personne ne verrait l'ensemble.

## 7. Décision attendue
**Réponse courte** : « C », « B », « D » ou « A ».

Sous-décisions :
1. **Nature de la supervision** : technique d'abord (recommandé), fonctionnelle seulement après avis juridique et RH ?
2. **Deux comptes distincts** pour la personne qui cumule administration d'identité et supervision (recommandé), ou un seul ?
3. **Second administrateur d'identité nominatif** : qui, et à quelle date ?
4. **Compte de secours** : détenteur, conditions d'usage, alerte à chaque utilisation.
5. **Administrateur de chaque plateforme** : à nommer (par exemple RH pour RH, la direction financière pour Finances).
6. **Ce que voit le superviseur** : connexions, sessions actives, erreurs, état des plateformes, journal d'audit **sans le contenu des données** (recommandé) ; liste à valider.

Après la réponse : consignation au registre des décisions, ADR, puis seulement exécution.
