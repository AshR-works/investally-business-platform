# Arbitrage — S5.2 : sessions de formation, apprenants et inscriptions

*2026-11-06 · Préparé après la validation de S5.1 (catalogue). Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) — options dont le statu quo, grille pondérée sur 160, recommandation, **décision laissée à la Direction produit**. **Décidé le 2026-11-06 : recommandations appliquées (D47).** S5.2a démarre à votre signal.*

## 1. Contexte et contraintes

**Question.** Comment représenter une session de formation (un certificat, un rythme, une salle, un formateur), les apprenants et leurs inscriptions, de façon que les contrôles réels de l'école (places, postes, agrément) soient tenus par le système ?

**Acquis de S5.1 (à respecter, non rediscutés ici).**
- Une session concerne **un certificat** ; elle suit un **rythme** codé en dur : *jour* (1 semaine, lundi–vendredi, 9h–12h et 13h–17h, 35 h, ouvert) ou *soir* (2 semaines, 18h–21h, 30 h, **en préparation, non ouvert**).
- **Places utiles d'une salle = places apprenants − postes hors service** (salle de marchés : 13 ; salle de réunion : 16). Un module peut exiger des postes de travail (`requiresWorkstations`).
- Archivage sans suppression ; verrou optimiste ; audit dans la transaction ; erreurs métier → HTTP (400/404/409/422).
- Permissions déjà au catalogue : `training.session.{read,create,update,delete,cancel,close}`, `training.learner.*`, `training.enrollment.*`. Le Responsable Investudy a tout ; le formateur lit ses sessions (portée **Propre**) ; chargé de compte, Responsable commercial et Direction lisent.
- **Sécurité** : une inscription est rattachée à une **entreprise** ; elle suit donc la portée de l'entreprise (Propre / Équipe / Tous) et entre dans le contrat anti-IDOR comme toute route « objet ». Les sessions sont un référentiel partagé (classe « référentiel »), sauf la lecture du formateur.
- Cas d'usage de départ : [CAS-D-USAGE-MODULE-INVESTUDY](../CAS-D-USAGE-MODULE-INVESTUDY.md) (CU-I-20 à CU-I-45), antérieur au catalogue réel : **trois points sont à réaligner** (dates, capacité, modules pratiques) et rejoignent les décisions ci-dessous.

**Exigence en tension.** Le cas d'usage prévoyait des dates saisies librement et une capacité saisie. Le catalogue réel fixe la durée par le **rythme** et la capacité par la **salle** : saisir les deux librement permettrait des sessions que l'école ne peut pas tenir.

## 2. Valeurs par défaut proposées (hors arbitrage — à confirmer)
| # | Valeur | Raison |
|---|---|---|
| V1 | On saisit la **date de début** ; la **date de fin se calcule** d'après le rythme (jours ouvrés du lundi au vendredi). Les **jours fériés ne sont pas pris en compte** (D147), la fin peut être corrigée par le Responsable Investudy avec trace | Évite des durées incohérentes |
| V2 | États d'une session : **Planifiée → Ouverte → Clôturée**, et **Annulée** (depuis Planifiée ou Ouverte) ; « en cours » se déduit des dates, ce n'est pas un état saisi | Peu d'états, pas de désaccord possible entre état et dates |
| V3 | La session exige un **certificat actif**, une **salle active**, un **formateur actif** ; **aucune session** sur un rythme *non ouvert* (le soir tant qu'il est « en préparation ») | Cohérence avec S5.1 |
| V4 | **Chevauchement** : une salle ou un formateur ne peut tenir deux sessions aux dates qui se recouvrent ; refus avec la session en conflit | CU-I-20 |
| V5 | Une inscription exige une **session ouverte**, un **agrément valide** de l'entreprise, une place libre et un apprenant non déjà inscrit | CU-I-40 |
| V6 | Annuler une session **ne supprime aucune inscription** : elles passent « À replacer » ; une session clôturée ne s'annule pas | CU-I-23 |
| V7 | Le **paiement** n'est jamais saisi : l'état « réglé » arrive de la Finance par événement (lecture seule) ; **S5.2 ne l'affiche pas encore** (la Finance n'existe pas) | CU-I-45 |
| V8 | **Aucune notification** en S5.2 (comme D137 pour les commissions) | Reporté |

## 3. Les sept décisions

Poids (fixés avant de noter) : valeur métier 5 · risque 5 · cohérence 4 · réversibilité 4 · coût et délai 3 · maintenance 3 · expérience utilisateur 4 · accessibilité et sécurité 4 (**total 160**).

### D-SESS-1 — Qui confirme une inscription ?
**Contexte.** Une inscription créée par le chargé de compte consomme une place et déclenchera la demande de paiement. La capacité est un contrôle de l'école.

| Option | Description | Réversibilité |
|---|---|---|
| **A. Statu quo (proposition D31)** | Le chargé de compte inscrit (« En attente »), le **Responsable Investudy seul** confirme | 🟢 |
| B. Confirmation par le chargé de compte | L'inscription est confirmée dès sa création ; le Responsable Investudy peut l'annuler | 🟢 |
| C. Confirmation automatique | Confirmée dès que l'agrément et la place sont vérifiés, sans validation humaine | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 4 | 3 |
| Risque (5) | 5 | 3 | 2 |
| Cohérence (4) | 5 | 3 | 2 |
| Réversibilité (4) | 4 | 4 | 3 |
| Coût et délai (3) | 3 | 4 | 4 |
| Maintenance (3) | 4 | 4 | 3 |
| Expérience utilisateur (4) | 3 | 5 | 5 |
| Accessibilité et sécurité (4) | 5 | 4 | 4 |
| **Score pondéré (sur 160)** | **134** | **123** | **102** |

*Risques de A* : un goulot si le Responsable Investudy est absent. *Dette* : file de confirmation à écrire (une page). **Recommandation : A.** *Ce qui ferait changer d'avis* : un volume d'inscriptions où l'étape de confirmation devient un frein réel (alors B).
**Décision (2026-11-06, Direction produit) : A** — recommandation appliquée (D47).

### D-SESS-2 — Liste d'attente quand la session est complète
**Contexte.** Les salles ont 13 à 16 places utiles. Le cas d'usage laisse la liste d'attente « à trancher ».

| Option | Description | Réversibilité |
|---|---|---|
| **A. Statu quo** | Pas de liste : session complète = inscription refusée | 🟢 |
| B. Liste manuelle | « En liste d'attente » avec un rang ; le Responsable Investudy **promeut** | 🟡 |
| C. Liste automatique | Promotion automatique au premier rang quand une place se libère | 🔴 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (5) | 5 | 4 | 2 |
| Cohérence (4) | 5 | 4 | 3 |
| Réversibilité (4) | 5 | 4 | 2 |
| Coût et délai (3) | 5 | 3 | 2 |
| Maintenance (3) | 5 | 3 | 2 |
| Expérience utilisateur (4) | 3 | 4 | 4 |
| Accessibilité et sécurité (4) | 5 | 4 | 3 |
| **Score pondéré (sur 160)** | **142** | **122** | **90** |

*Risques de A* : le chargé de compte ne peut pas « réserver » une place pour un client en attente ; il doit revenir plus tard. *Dette* : aucune ; B reste ajoutable ensuite sans refonte (un état de plus). **Recommandation : A maintenant, B si le besoin apparaît.** C est écartée (une promotion automatique agit sur un agrément et une facturation sans personne qui décide).
**Décision (2026-11-06, Direction produit) : A** — recommandation appliquée (D47).

### D-SESS-3 — Reporter une session
**Contexte.** Le flux I5 prévoit annulation et report. Un report simple (même session, autre date) est plus fréquent qu'une annulation.

| Option | Description | Réversibilité |
|---|---|---|
| **A. Statu quo** | Pas de report dédié : on **annule** (inscriptions « À replacer »), puis on **recrée** une session | 🟢 |
| B. Report = modification de la date de début | Les inscrits sont **conservés**, motif obligatoire, confirmation, trace de l'ancienne et de la nouvelle date | 🟢 |
| C. Les deux | Report et annulation, avec choix à chaque fois | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 5 | 5 |
| Risque (5) | 5 | 4 | 3 |
| Cohérence (4) | 4 | 4 | 3 |
| Réversibilité (4) | 4 | 4 | 3 |
| Coût et délai (3) | 4 | 3 | 2 |
| Maintenance (3) | 4 | 4 | 2 |
| Expérience utilisateur (4) | 2 | 5 | 4 |
| Accessibilité et sécurité (4) | 4 | 4 | 4 |
| **Score pondéré (sur 160)** | **120** | **134** | **108** |

*Risques de B* : une salle ou un formateur indisponible à la nouvelle date (le contrôle de chevauchement s'applique, V4) ; un agrément expiré entre-temps (l'inscription conservée n'est pas recontrôlée : **à trancher** — proposé : avertissement seulement). *Dette* : conséquences financières d'un report (délai, remboursement) renvoyées à la Finance. **Recommandation : B** (l'annulation reste disponible pour les cas où la session ne se tient plus).
**Décision (2026-11-06, Direction produit) : B** — recommandation appliquée (D47).

### D-SESS-4 — Apprenant et contact
**Contexte.** Un apprenant peut être un contact de l'entreprise (qui a signé l'agrément) ou une autre personne. FD-9 propose de le confirmer distinct.

| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Pas d'entité apprenant : on réutilise les **contacts** | 🔴 |
| **B. Entité distincte, lien facultatif** | Fiche apprenant (nom, prénom, entreprise, e-mail, téléphone) avec **lien facultatif** vers un contact ; **doublon probable** signalé (même entreprise et même nom ou e-mail) | 🟡 |
| C. Entité distincte, sans lien | Aucun rapprochement avec les contacts | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 2 | 5 | 3 |
| Risque (5) | 3 | 4 | 3 |
| Cohérence (4) | 3 | 5 | 3 |
| Réversibilité (4) | 2 | 4 | 3 |
| Coût et délai (3) | 5 | 3 | 4 |
| Maintenance (3) | 5 | 3 | 3 |
| Expérience utilisateur (4) | 3 | 4 | 2 |
| Accessibilité et sécurité (4) | 4 | 4 | 4 |
| **Score pondéré (sur 160)** | **103** | **131** | **99** |

*Risques de B* : doublons apprenant / contact, et deux fiches à tenir à jour. *Dette* : les suggestions d'ambassadeur après certification (S5.3) partent de l'apprenant. **Recommandation : B.**
**Décision (2026-11-06, Direction produit) : B** — recommandation appliquée (D47).

### D-SESS-5 — Capacité d'une session et places de la salle
**Contexte.** Salle de marchés : 14 postes apprenants dont 1 en panne → 13 places utiles. Le cas d'usage laissait la capacité libre avec un simple avertissement.

| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Capacité saisie librement, **avertissement** si elle dépasse la salle | 🟢 |
| **B. Plafond bloquant, ajustable à la baisse** | Capacité saisie, **refusée au-delà des places utiles** de la salle ; peut être réduite (jamais sous le nombre d'inscrits confirmés) | 🟢 |
| C. Capacité imposée | Capacité = places utiles, non saisie | 🟡 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 5 | 4 |
| Risque (5) | 2 | 5 | 5 |
| Cohérence (4) | 2 | 5 | 4 |
| Réversibilité (4) | 4 | 4 | 4 |
| Coût et délai (3) | 4 | 4 | 5 |
| Maintenance (3) | 4 | 4 | 4 |
| Expérience utilisateur (4) | 3 | 4 | 3 |
| Accessibilité et sécurité (4) | 4 | 4 | 4 |
| **Score pondéré (sur 160)** | **101** | **142** | **132** |

*Risques de B* : un poste tombe en panne **après** la création de la session (les places utiles baissent sous la capacité ou sous les inscrits) : la modification de la salle n'est pas bloquée mais **signale** les sessions touchées (proposé), sans désinscrire personne. *Dette* : aucune. **Recommandation : B.**
**Décision (2026-11-06, Direction produit) : B** — recommandation appliquée (D47).

### D-SESS-6 — Modules pratiques et type de salle
**Contexte.** Les modules de trading exigent des postes ; un cours magistral peut se tenir en salle de réunion. S5.1 n'a pas planifié module par module (D148).

| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Aucun contrôle entre les modules du certificat et la salle | 🟢 |
| **B. Salle principale avec postes si un module en exige** | **Bloquant** : un certificat contenant au moins un module pratique ne peut se tenir que dans une salle « avec postes de travail ». Le déplacement ponctuel d'un cours en salle de réunion reste hors du système tant que D148 n'est pas traité | 🟢 |
| C. Avertissement seulement | Même règle que B, mais **passage possible** après confirmation tracée | 🟢 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 2 | 4 | 4 |
| Risque (5) | 2 | 4 | 3 |
| Cohérence (4) | 2 | 5 | 4 |
| Réversibilité (4) | 5 | 4 | 5 |
| Coût et délai (3) | 5 | 4 | 4 |
| Maintenance (3) | 5 | 4 | 4 |
| Expérience utilisateur (4) | 3 | 4 | 4 |
| Accessibilité et sécurité (4) | 4 | 4 | 4 |
| **Score pondéré (sur 160)** | **106** | **132** | **127** |

*Écart de 5 points seulement entre B et C* : B est plus strict, C reflète que l'école **déplace parfois un cours** vers la salle de réunion. **Recommandation : B**, car le déplacement d'un cours n'est de toute façon pas représentable avant D148 et un contrôle bloquant est plus simple à assouplir (vers C) que l'inverse. *Ce qui ferait changer d'avis* : des sessions entières régulièrement tenues hors salle de marchés (alors C).
**Décision (2026-11-06, Direction produit) : B** — recommandation appliquée (D47).

### D-SESS-7 — Données personnelles des apprenants
**Contexte.** Conservation et suppression : le sujet est ouvert depuis D11, D55 et D65. Il faut une règle minimale avant d'enregistrer des apprenants.

| Option | Description | Réversibilité |
|---|---|---|
| A. Statu quo | Aucune suppression : tout est conservé, indéfiniment | 🟢 |
| **B. Suppression logique encadrée** | Le Responsable Investudy supprime (logiquement, avec confirmation et trace) un apprenant **sans inscription confirmée ni certification** ; durée de conservation à fixer plus tard | 🟡 |
| C. Purge automatique | Effacement après N ans, sans action humaine | 🔴 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (5) | 2 | 4 | 3 |
| Cohérence (4) | 3 | 5 | 3 |
| Réversibilité (4) | 5 | 4 | 2 |
| Coût et délai (3) | 5 | 4 | 2 |
| Maintenance (3) | 4 | 4 | 2 |
| Expérience utilisateur (4) | 2 | 4 | 3 |
| Accessibilité et sécurité (4) | 3 | 4 | 4 |
| **Score pondéré (sur 160)** | **104** | **132** | **95** |

*Risques de B* : une suppression logique n'est pas un effacement légal (les données restent en base) ; la durée et la base légale sont **à faire valider par le conseil juridique** avant la mise en production (plan de mise en production). *Dette* : politique de conservation (D11, D65). **Recommandation : B**, avec la mention explicite que le juridique reste ouvert. C est écartée tant que la durée n'est pas fixée.
**Décision (2026-11-06, Direction produit) : B** — recommandation appliquée (D47).

## 4. Découpage proposé (à confirmer)
S5.2 est annoncé à 1,5 session. Je propose **deux lots validables séparément**, comme S4.4a/b/c :

| Lot | Contenu | Preuves attendues |
|---|---|---|
| **S5.2a — Sessions** | Planifier (début + rythme → fin), ouvrir, modifier, annuler / reporter, clôture exclue (S5.3), liste et calendrier ; contrôles V3, V4, D-SESS-5 et D-SESS-6 ; jeu de démonstration (sessions passée, en cours, à venir) | Tests unitaires, intégration, IDOR, mutants, audit navigateur, recette |
| **S5.2b — Apprenants et inscriptions** | Fiche apprenant (doublon, lien contact), inscription avec contrôle d'agrément, de capacité et de doublon, confirmation, annulation, replacement ; suppression logique | Idem ; cas d'usage F1 (agrément) rejoué de bout en bout |

*Ordre* : S5.2a d'abord (les inscriptions ont besoin de sessions).

## 5. Récapitulatif des recommandations
| Décision | Recommandation | Score | Alternative la plus proche |
|---|---|---|---|
| D-SESS-1 Confirmation | **A** — le Responsable Investudy seul | 134 | B (123) |
| D-SESS-2 Liste d'attente | **A** — pas de liste (B plus tard) | 142 | B (122) |
| D-SESS-3 Report | **B** — modification de la date de début | 134 | A (120) |
| D-SESS-4 Apprenant | **B** — entité distincte, lien facultatif | 131 | A (103) |
| D-SESS-5 Capacité | **B** — plafond bloquant | 142 | C (132) |
| D-SESS-6 Modules pratiques | **B** — salle avec postes obligatoire | 132 | C (127) |
| D-SESS-7 Données apprenants | **B** — suppression logique encadrée | 132 | A (104) |

## 6. Décision
**« Applique les recommandations »** (2026-11-06) : D-SESS-1 A ; 2 A ; 3 B ; 4 B ; 5 B ; 6 B ; 7 B ; V1 à V8 confirmées ; découpage S5.2a puis S5.2b. Consignée en **D47** (`QUESTIONS-ET-DECISIONS`). Prochaine étape : **S5.2a** à votre signal.

*Points hors S5.2, déjà ouverts :* seuils de certification, barème des évaluations, numérotation des certificats (S5.3) ; FD-9 et FD-11 (confirmation du périmètre Investudy et des formateurs externes) ; D-FORM-1 à 3 du cadrage formation.
