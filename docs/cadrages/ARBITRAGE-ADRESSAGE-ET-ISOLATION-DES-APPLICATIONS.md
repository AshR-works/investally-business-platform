# Arbitrage — adressage et isolation des applications (une adresse ou plusieurs)

*2026-11-25 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). **Aucun code n'est écrit** tant que la décision n'est pas prise. Les notes de la grille sont des jugements de l'équipe technique, à contester. Cet arbitrage **rouvre en partie** [ARBITRAGE-ARCHITECTURE-RESTRUCTURATION](ARBITRAGE-ARCHITECTURE-RESTRUCTURATION.md).*

## 1. La question
Les applications métier doivent-elles être servies à **trois ou quatre adresses différentes**, ou **à une seule adresse qui les héberge toutes** ? La Direction générale pose une **exigence ferme** : les différentes applications ne doivent **pas être exposées les unes aux autres**.

**Précision de la Direction produit (2026-11-25) :** le DG a envisagé des **applications accessibles via des adresses différentes** ; l'idée de « métiers séparés » est la conclusion que la Direction produit en a tirée. Cela rend l'option 3 (une adresse par application) plus conforme à ce que le DG a lui-même imaginé, sans que sa raison soit connue (isolation technique ou simple organisation).

Point à clarifier : le nombre d'applications. Quatre métiers ont été cités (CRM avec Investudy, RH, Assets Management, Finances) ; la question parle de trois. Cet arbitrage raisonne sur quatre.

Lecture retenue de l'exigence : **la compromission ou la panne d'une application ne donne accès ni aux données ni aux sessions d'une autre.** Elle est traitée comme une condition d'entrée, non comme un critère noté.

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| Hébergement : serveur virtuel avec Docker Compose ; sous-domaine dédié « sans toucher au DNS du domaine principal » tant que la messagerie n'est pas migrée ; certificat automatique | D63 |
| Accès au DNS : prérequis externe encore en attente (constat DNS du 2026-11-10, fiche de rencontre avec la Direction générale) | D62 |
| Le registre prévoyait « l'extraction de l'identité vers une connexion unique » pour l'ERP | Reste à faire |
| Aujourd'hui : une seule application, une seule session, une seule base (un schéma par module) | État actuel |
| Développeur seul | — |

Conséquence sur l'arbitrage d'architecture : l'hypothèse « séparés = droits et navigation » est probablement **insuffisante**. L'option D (un seul déploiement) ne respecte pas à elle seule l'exigence du DG.

## 3. Options
| | Principe | Respecte l'exigence du DG ? |
|---|---|---|
| **1. Statu quo** | Une adresse, une seule application, un espace par métier (`/crm`, `/rh`, …) | **Non** : un seul processus, une seule session, une seule base |
| **2. Une adresse, plusieurs applications derrière une passerelle** | Applications et bases séparées, réseaux isolés, répartition par chemin | **En partie** : isolées côté serveur, mais même origine dans le navigateur ; une faille dans une page expose les sessions des autres |
| **3. Une adresse par application** | `crm.`, `rh.`, `assets.`, `finances.` : chacune son application et sa base, un service d'identité central (connexion unique) | **Oui** |
| **4. Hybride** | Un portail à l'adresse principale (accueil, identité), `rh.` et `finances.` à part (données personnelles et comptables), CRM et Assets regroupés | **En partie** : CRM et Assets restent exposés l'un à l'autre |

## 4. Grille (poids de 1 à 5, maximum 105)
| Critère (poids) | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Isolation entre applications (5) | 1 | 3 | 5 | 4 |
| Charge et délai pour un développeur seul (5) | 5 | 3 | 2 | 3 |
| Exploitation : DNS, certificats, supervision (4) | 5 | 3 | 2 | 3 |
| Expérience intranet : connexion unique, passage fluide entre métiers (4) | 5 | 4 | 3 | 4 |
| Réemploi de l'existant (3) | 5 | 3 | 2 | 3 |
| **Total** | **85** | **67** | **61** | **72** |

Totaux recalculés : 1 = 5 + 25 + 20 + 20 + 15 ; 2 = 15 + 15 + 12 + 16 + 9 ; 3 = 25 + 10 + 8 + 12 + 6 ; 4 = 20 + 15 + 12 + 16 + 9.

**L'option 1 arrive en tête mais elle est exclue** : elle échoue à l'exigence ferme du DG, que la grille ne peut pas exprimer comme un score. Parmi les autres, c'est l'option 4 qui est devant, mais elle ne respecte l'exigence que si CRM et Assets peuvent partager une application.

## 5. Risques et dette
- **Échanges entre métiers :** certains besoins traversent les applications (demande de formation RH vers l'ancien Investudy, bien Assets affecté à un employé RH, Finances qui lit les commissions du CRM). Avec des applications isolées, ils passent par un échange contrôlé (messages ou API interne minimale), **jamais par un accès direct à la base d'une autre**. Le patron d'événements reporté devient obligatoire.
- **DNS :** les options 3 et 4 demandent de créer des sous-domaines et des certificats ; l'accès au DNS est un prérequis externe encore en attente (D62).
- **Charge :** l'option 3 multiplie déploiements, bases et sauvegardes. Pour un développeur seul, c'est le vrai coût.
- **Dette :** une connexion unique à construire (OIDC) ; sans elle, les comptes se dupliquent.

## 6. Recommandation
**Option 4, sous condition** : c'est la meilleure note parmi celles qui approchent l'exigence, et elle isole les deux métiers les plus sensibles (RH : données personnelles ; Finances : données comptables). **Si le DG veut littéralement quatre applications mutuellement fermées, c'est l'option 3**, construite par étapes : l'identité d'abord, puis un métier à la fois.

L'écart entre l'option 4 et la lecture littérale tient à CRM et Assets partagés : seul le DG peut dire s'il l'accepte.

## 7. Décision attendue
**Réponse courte** : « option 4 » ou « option 3 ».

Sous-décisions :
1. **Sens de « ne pas exposer »** : serveur et données seulement, ou aussi que l'utilisateur d'une application ne voie pas qu'elle fait partie d'un ensemble (ni lien, ni menu commun) ?
2. **Identité** : un service d'identité central avec connexion unique (recommandé), ou des comptes par application ?
3. **Échanges entre applications** : messages et API interne minimale, jamais d'accès direct aux bases (recommandé) ?
4. **Nombre d'applications** : trois ou quatre, et lesquelles ?
5. **DNS** : qui peut créer les sous-domaines, et à quelle date ?
6. **Hébergement** : un serveur avec des réseaux Docker isolés (recommandé), ou un serveur par application ?

Après la réponse : consignation au registre des décisions (en même temps que l'arbitrage d'architecture), ADR, puis seulement exécution.
