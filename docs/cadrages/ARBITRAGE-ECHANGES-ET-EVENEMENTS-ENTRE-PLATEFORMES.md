# Arbitrage — échanges et événements entre les plateformes (informations transversales, audit, indicateurs, notifications)

*2026-11-25 · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). **Aucun code n'est écrit** tant que la décision n'est pas prise. Les notes de la grille sont des jugements de l'équipe technique, à contester. À lire avec [ARBITRAGE-ARCHITECTURE-RESTRUCTURATION](ARBITRAGE-ARCHITECTURE-RESTRUCTURATION.md), [ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS](ARBITRAGE-ADRESSAGE-ET-ISOLATION-DES-APPLICATIONS.md), [ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS](ARBITRAGE-PARCOURS-D-ENTREE-AUX-APPLICATIONS.md) et [ARBITRAGE-ADMINISTRATION-ET-SUPERVISION-DES-PLATEFORMES](ARBITRAGE-ADMINISTRATION-ET-SUPERVISION-DES-PLATEFORMES.md), toujours en attente de décision.*

## 1. La question
Quatre plateformes isolées (CRM avec Investudy, RH, Finances, Assets Management) ne s'exposent pas les unes aux autres, c'est l'exigence du DG. Comment échangent-elles pourtant les informations et les événements dont elles ont besoin ?

Quatre sortes de flux sont concernées :
- la **supervision technique**, y compris le journal d'audit ;
- les **données métier partagées** (un employé RH utilisé par Assets, des commissions du CRM reprises en Finances, le budget d'une formation externe) ;
- les **indicateurs pour la Direction** (tableaux de bord sur plusieurs métiers) ;
- les **notifications entre utilisateurs** (validations, communications).

Cet arbitrage reprend deux points reportés le 2026-11-24 (le patron d'échange entre modules, le système de notifications) et la question encore sans réponse : le DG accepte-t-il que de petites informations circulent entre plateformes, sous contrôle ?

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| Les modules communiquent aujourd'hui **dans un seul processus** ; la suggestion d'ambassadeur est créée par appel direct dans le cas d'usage de délivrance (précédent, non encore généralisé) | D77 |
| Les modules se référencent par identifiant, sans clé étrangère entre schémas | D161 |
| Le journal d'audit enregistre l'**avant et l'après** de chaque modification, donc des données métier | État actuel |
| Aucune notification entre utilisateurs ; e-mails sans file durable | Valeur par défaut V8, D11, D26 |
| Les plateformes sont isolées, avec une identité centrale ; le superviseur lit sans écrire et **sans le contenu des données** (option C de l'administration, recommandée) | Arbitrages d'adressage et d'administration |
| Besoins identifiés, à confirmer : employé RH vers Assets, commissions CRM vers Finances, budget d'une formation externe RH vers Finances (contenu à préciser avec la direction financière) | Retours du DG |
| Développeur seul | — |

## 3. Options
| | Principe | Respecte l'exigence du DG ? |
|---|---|---|
| **0. Statu quo** | Appels internes dans un seul processus | **Non** : impossible avec des plateformes séparées |
| **A. Aucun échange automatique** | Plateformes totalement étanches ; ressaisie à la main, exports et imports | **Oui** |
| **B. Boîte d'envoi et interface interne signée** | Chaque plateforme publie des événements d'une liste fermée dans sa boîte d'envoi, une interface interne signée les transmet ; pas d'outil de plus | **Oui, sous contrôle** : un seul canal, aucune lecture directe |
| **C. Courtier de messages** | Un service de messagerie dédié entre les plateformes | **Oui, sous contrôle** |
| **D. Accès libre** | Appels libres entre plateformes ou base de données partagée | **Non** : chaque plateforme voit les autres |

## 4. Grille (poids de 1 à 5, maximum 100)
| Critère (poids) | 0 | A | B | C | D |
|---|---|---|---|---|---|
| Respect de l'exigence de non-exposition (5) | 1 | 5 | 4 | 4 | 1 |
| Couverture des besoins : données partagées, supervision, indicateurs, notifications (5) | 5 | 1 | 4 | 5 | 5 |
| Charge et délai pour un développeur seul (4) | 5 | 5 | 3 | 2 | 4 |
| Fiabilité : un événement n'est ni perdu ni traité deux fois (3) | 4 | 2 | 4 | 5 | 3 |
| Exploitation : peu d'infrastructure à surveiller (3) | 5 | 5 | 4 | 2 | 3 |
| **Total** | **77** | **71** | **76** | **74** | **64** |

Totaux recalculés : 0 = 5 + 25 + 20 + 12 + 15 ; A = 25 + 5 + 20 + 6 + 15 ; B = 20 + 20 + 12 + 12 + 12 ; C = 20 + 25 + 8 + 15 + 6 ; D = 5 + 25 + 16 + 9 + 9.

**L'option 0 arrive en tête mais elle est exclue** : elle échoue à l'exigence ferme du DG et n'est pas applicable à des plateformes séparées, ce que la grille ne peut pas exprimer comme un score. D est exclue pour la même raison. Entre B et C, **l'écart est de deux points** : la grille ne les départage pas nettement.

## 5. Principes du contrat d'échange (valables pour B et C)
- **Un propriétaire par donnée** : une seule plateforme la modifie et la publie ; les autres la reçoivent.
- **Une liste fermée d'événements**, versionnée, chacun documenté et validé ; ajouter un événement est une décision.
- **Contenu minimal** : une référence et les champs strictement nécessaires ; jamais l'avant/après complet ; jamais de donnée sensible RH.
- **Copie de lecture** : la plateforme destinataire garde ce dont elle a besoin ; elle n'accède jamais à la base d'une autre.
- **Idempotence et reprise** : chaque événement a un identifiant ; le traiter deux fois ne change rien ; un échec se rejoue.
- **Authentification entre plateformes** : un jeton de service propre à chaque plateforme, limité aux événements autorisés.

Événements candidats (à valider) :
| Événement | De | Vers | Contenu (indicatif) |
|---|---|---|---|
| Employé créé, modifié, sorti | RH | Assets | Identifiant, nom, service, responsable |
| Commission due, débloquée, versée | CRM | Finances | Référence, montant, devise, statut |
| Formation externe approuvée | RH | Finances | Référence, montant : **à préciser avec la direction financière** |
| Signaux techniques (erreurs, état, audit expurgé) | Toutes | Supervision | Plateforme, type, heure, acteur, type d'objet et identifiant opaque : **jamais les valeurs** |
| Indicateurs agrégés | Toutes | Espace central de la Direction | Totaux et compteurs, pas de données brutes |
| Notification à un utilisateur | Toutes | Identité, qui sait où le joindre | Message court et lien |

## 6. Risques et dette
- **Cohérence à terme** : une copie peut avoir un léger retard sur le propriétaire ; garder une référence vers la donnée d'origine.
- **Événements perdus ou doublés** : boîte d'envoi, identifiants, traitement idempotent.
- **Journal d'audit** : ce qui remonte au superviseur doit être expurgé **avant** de quitter la plateforme ; c'est un travail à prévoir, pas un réglage.
- **E-mails sans file durable (D26)** : le même mécanisme de file durable peut les couvrir ; à traiter avec ce chantier.
- **Évolution des événements** : versionnement et compatibilité, sinon une plateforme met toutes les autres en erreur.
- **Supervision du canal** : une file en retard doit déclencher une alerte dans la console de supervision.
- **Charge** : B n'ajoute pas d'outil mais demande plus de code que le statu quo ; C ajoute un service à déployer et à surveiller.
- **Dépend des autres arbitrages** : si les plateformes ne sont finalement pas isolées, l'option 0 redevient applicable.

## 7. Recommandation
**Option B**, avec le contrat d'échange de la section 5 et une liste fermée d'événements. Elle respecte l'exigence du DG par un canal unique et contrôlé, couvre les besoins sans ajouter d'outil à exploiter, et reste évolutive vers C si la fiabilité ou le volume l'exigent.

Si le DG répond que les plateformes ne doivent **jamais** échanger, c'est l'option A, au prix de ressaisies manuelles : par exemple recréer un employé dans Assets, et reprendre les commissions à la main en Finances.

## 8. Décision attendue
**Réponse courte** : « B », « C », « A » (ou « 0 »).

Sous-décisions :
1. **Réponse du DG** : des échanges contrôlés sont-ils acceptés (recommandé) ou « jamais » (option A) ?
2. **Événements initiaux** : valider ou corriger les six candidats de la section 5.
3. **Propriétaire de chaque donnée partagée** : employé = RH, commission = CRM, etc. (à valider).
4. **Journal d'audit** : remontée **expurgée** au superviseur, chaque plateforme gardant son journal complet (recommandé), ou journal central complet, ou aucune remontée ?
5. **Indicateurs pour la Direction** : un espace central transverse (recommandé), ou un tableau de bord par plateforme ?
6. **Notifications entre utilisateurs** : sur le même canal, dans un second temps (recommandé), ou plus tard ?
7. **Qui valide un nouvel événement** : la Direction produit (recommandé), ou chaque plateforme pour les siens ?

Après la réponse : consignation au registre des décisions, ADR, puis seulement exécution.
