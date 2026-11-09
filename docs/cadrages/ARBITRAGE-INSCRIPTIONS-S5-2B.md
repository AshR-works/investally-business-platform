# Arbitrage — S5.2b : apprenants et inscriptions

*2026-11-07 · Complète l'arbitrage [ARBITRAGE-SESSIONS-ET-INSCRIPTIONS-S5-2](ARBITRAGE-SESSIONS-ET-INSCRIPTIONS-S5-2.md) (D47, déjà décidé) : il reste **trois questions** que ce document n'avait pas tranchées, parce qu'elles dépendent du modèle réel de l'agrément. Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) — options dont le statu quo, grille pondérée sur 160, recommandation, **décision laissée à la Direction produit**. **Décidé le 2026-11-09 : recommandations appliquées (D49).** S5.2b est lancé.*

## 1. Contexte et contraintes

**Question.** Comment inscrire un apprenant à une session en tenant les contrôles réels de l'école : agrément de l'entreprise, places de la session, doublons ?

**Déjà décidé (D47, non rediscuté).**
- Le **Responsable Investudy seul confirme** une inscription ; le chargé de compte inscrit (« En attente de confirmation »).
- **Pas de liste d'attente** : une session complète refuse l'inscription.
- Un report de session **conserve les inscrits** ; une annulation **ne supprime aucune inscription** (elles passent « À replacer »).
- **Apprenant = entité distincte**, lien facultatif vers un contact, **doublon probable signalé** (même entreprise et même nom ou e-mail) ; **suppression logique** par le Responsable Investudy seulement, refusée avec une inscription confirmée ou une certification ; durée de conservation à fixer avec le juridique (D11, D65).
- Le paiement n'est jamais saisi : l'état « réglé » viendra de la Finance (rien à afficher en S5.2b).

**Faits du modèle réel qui posent les trois questions.**
- Un **agrément** (module commercial) est rattaché à une entreprise et porte **une somme globale, un nombre de places, ou les deux** (au moins l'un des deux), une devise, une date de réception, une **fin de validité facultative**, et un **état** : *Demandé* (promesse pas encore signée), *Reçu* (promesse signée), *Honoré* (paiement constaté par la Finance), *Expiré*, *Annulé*.
- Un **certificat** porte un prix complet et un prix par module, **tous deux facultatifs** et jusqu'ici **purement informatifs** (dette D144).
- Une session a une **capacité** plafonnée par les places utiles de sa salle (13 en salle de marchés).
- Une inscription est rattachée à une **entreprise** : elle suit sa portée (chargé de compte : les siennes ; Responsable commercial : son équipe ; Investudy, Direction, Support, Finance : lecture « Tous ») et entre dans le contrat anti-IDOR.

Poids (fixés avant de noter) : valeur métier 5 · risque 5 · cohérence 4 · réversibilité 4 · coût et délai 3 · maintenance 3 · expérience utilisateur 4 · accessibilité et sécurité 4 (**total 160**).

## 2. Les trois décisions

### D-INS-1 — Quel agrément autorise une inscription ?
**Contexte.** L'inscription est conditionnée par un agrément « valide » de l'entreprise (CU-I-40). Un agrément seulement demandé n'engage pas encore le client ; un agrément honoré a été payé.

| Option | Description | Réversibilité |
|---|---|---|
| **A. Strict** | Agrément **Reçu ou Honoré**, dont la **fin de validité** (si elle existe) couvre la date de début de la session ; refus avec un message qui dit pourquoi | 🟢 |
| B. Souple | Accepte aussi un agrément **Demandé** (la promesse n'est pas encore signée) | 🟢 |
| C. Statu quo | Aucun contrôle d'agrément à l'inscription : seule l'entreprise de l'apprenant compte | 🟢 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 5 | 4 | 2 |
| Risque (5) | 5 | 3 | 1 |
| Cohérence (4) | 5 | 3 | 1 |
| Réversibilité (4) | 4 | 4 | 5 |
| Coût et délai (3) | 3 | 3 | 5 |
| Maintenance (3) | 4 | 4 | 5 |
| Expérience utilisateur (4) | 3 | 4 | 5 |
| Accessibilité et sécurité (4) | 4 | 3 | 3 |
| **Score pondéré (sur 160)** | **135** | **112** | **101** |

*Risques de A* : un chargé de compte voudra inscrire avant la signature ; il devra attendre l'état « Reçu » (ou saisir la réception). *Dette* : le sens d'« expiré » pendant une session déjà commencée (on ne contrôle que la date de début). **Recommandation : A.** *Ce qui ferait changer d'avis* : un usage courant d'inscriptions « sous réserve » avant signature (alors B, avec avertissement).
**Décision (2026-11-09, Direction produit) : A** — recommandation appliquée (D49).

### D-INS-2 — Que consomme une inscription sur l'agrément ?
**Contexte.** « Cumul des inscriptions dans le montant ou le nombre de places de l'agrément » (CU-I-40). Un agrément en places se compte facilement ; un agrément en somme suppose de valoriser chaque inscription, donc d'utiliser le **prix du certificat**, aujourd'hui informatif.

| Option | Description | Réversibilité |
|---|---|---|
| **A. Compter les deux** | Chaque inscription (en attente ou confirmée) consomme **1 place** d'un agrément en places et le **prix complet du certificat** d'un agrément en somme ; si l'agrément porte les deux, **les deux plafonds** s'appliquent. Un certificat **sans prix complet** ne peut pas s'inscrire sous un agrément en somme (message explicite) | 🟡 |
| B. Places seulement | Le **nombre de places** est contrôlé ; la **somme est informative** (aucun contrôle de montant) | 🟢 |
| C. Statu quo | Aucun cumul : l'agrément valide autorise d'inscrire sans limite | 🟢 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 5 | 4 | 2 |
| Risque (5) | 5 | 3 | 1 |
| Cohérence (4) | 5 | 3 | 2 |
| Réversibilité (4) | 3 | 4 | 5 |
| Coût et délai (3) | 2 | 4 | 5 |
| Maintenance (3) | 3 | 4 | 5 |
| Expérience utilisateur (4) | 3 | 4 | 5 |
| Accessibilité et sécurité (4) | 4 | 4 | 4 |
| **Score pondéré (sur 160)** | **125** | **119** | **109** |

*Risques de A* : les prix du catalogue deviennent **contraignants** (D144 change) ; une saisie de prix manquante ou erronée bloque des inscriptions légitimes ; un agrément en somme ne dit rien du prix par module. L'écart avec B est de 6 points seulement. *Dette* : valorisation d'une inscription à un seul module (prix par module), remises, devise différente de celle de l'agrément (refusée). **Recommandation : A**, parce que le cumul en somme est l'objet même du flux F1 ; si vous jugez les prix du catalogue pas assez fiables aujourd'hui, **B** est une base saine à laquelle on ajoute le contrôle en somme plus tard sans refonte.
**Décision (2026-11-09, Direction produit) : A** — recommandation appliquée (D49).

### D-INS-3 — À quel moment une place est-elle prise ?
**Contexte.** Le cas d'usage de départ décompte la place **à la confirmation** (CU-I-41) ; D47 (pas de liste d'attente) suppose qu'une session complète **refuse** l'inscription, ce qui se joue à la création.

| Option | Description | Réversibilité |
|---|---|---|
| **A. Dès la création** | Une inscription **en attente ou confirmée** occupe une place ; refus à la création quand la session est pleine ; annulée ou « à replacer », elle libère la place | 🟢 |
| B. À la confirmation | On peut inscrire au-delà de la capacité ; la **confirmation** est refusée si la session est pleine | 🟢 |
| C. Statu quo | Capacité non contrôlée aux inscriptions | 🟢 |

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 5 | 3 | 1 |
| Risque (5) | 5 | 3 | 1 |
| Cohérence (4) | 5 | 3 | 1 |
| Réversibilité (4) | 4 | 4 | 5 |
| Coût et délai (3) | 4 | 3 | 5 |
| Maintenance (3) | 4 | 3 | 5 |
| Expérience utilisateur (4) | 4 | 3 | 3 |
| Accessibilité et sécurité (4) | 4 | 4 | 3 |
| **Score pondéré (sur 160)** | **142** | **104** | **88** |

*Risques de A* : des inscriptions « en attente » jamais confirmées bloquent des places (le Responsable Investudy les voit dans la file et peut les annuler). Les deux inscriptions simultanées sur la dernière place sont départagées par un verrou sur la session. *Dette* : aucune ; B reste ajoutable ensuite. **Recommandation : A.**
**Décision (2026-11-09, Direction produit) : A** — recommandation appliquée (D49).

## 3. Valeurs par défaut proposées (hors arbitrage — à confirmer)
| # | Valeur |
|---|---|
| V9 | États d'une inscription : **En attente de confirmation → Confirmée**, **Annulée** (motif obligatoire) et **À replacer** (session annulée) |
| V10 | On inscrit à une session **Ouverte** ; l'apprenant doit appartenir à **la même entreprise que l'agrément** ; un apprenant n'est inscrit qu'**une fois** par session (hors inscription annulée) ; il ne peut pas être inscrit à **deux sessions qui se recouvrent** |
| V11 | Annuler une inscription libère la place et l'agrément ; **impossible une fois la session clôturée** |
| V12 | **Annuler une session** place ses inscriptions (en attente ou confirmées) « à replacer », dans la même transaction ; **reporter** une session les conserve |
| V13 | **Replacer** une inscription crée une nouvelle inscription sur une autre session ouverte (mêmes contrôles) ; l'ancienne est annulée avec le lien vers la nouvelle |
| V14 | La **capacité d'une session ne descend pas sous le nombre d'inscrits** (en attente ou confirmés) |
| V15 | Fiche apprenant : nom, prénom, entreprise, e-mail et téléphone facultatifs (règles communes) ; **lien facultatif vers un contact de la même entreprise** ; l'entreprise d'un apprenant **ne change pas** ; aucune notification |
| V16 | Droits : le chargé de compte crée et modifie **ses** apprenants et inscriptions (portée de l'entreprise) ; le Responsable commercial voit son équipe ; **Investudy** confirme, annule, replace, supprime logiquement ; Direction, Support et Finance lisent |

## 4. Récapitulatif
| Décision | Recommandation | Score | Alternative la plus proche |
|---|---|---|---|
| D-INS-1 Agrément éligible | **A** — Reçu ou Honoré, validité couvrant le début | 135 | B (112) |
| D-INS-2 Consommation de l'agrément | **A** — places et somme (prix complet du certificat) | 125 | B (119) |
| D-INS-3 Place prise | **A** — dès la création | 142 | B (104) |

## 5. Décision
**« Applique les recommandations »** (2026-11-09) : D-INS-1 A ; D-INS-2 A ; D-INS-3 A ; V9 à V16 confirmées. Consignée en **D49** (`QUESTIONS-ET-DECISIONS`). S5.2b : apprenants, inscriptions, contrôles, annulation et report de session reliés aux inscriptions, écran, jeu de démonstration, tests, mutants, recette.
