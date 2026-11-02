# Feuille de décision — décisions en attente

**Date** : 2026-11-02 · **Méthode** : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md) · **Statut** : **à trancher par la direction produit** · **Rien n'est implémenté avant votre réponse** (sauf mention contraire).

*Je suis l'équipe qui éclaire ; vous décidez. Pour chaque décision structurante : contexte, options (statu quo compris), grille calculée, risques, dette, recommandation. Les décisions courtes (confirmations, actions externes) sont en fin de document.*

## Comment répondre
Répondez par une ligne par décision, par exemple : **« FD-1 B ; FD-2 A (2.1 c, 2.2 a) ; FD-3 B ; FD-4 A ; FD-5 A ; FD-6 B ; FD-7 tout confirmer sauf … ; FD-8 voir mes réponses ; FD-10 B ; FD-11 B (11.1 a) »**. « **Applique les recommandations** » vaut décision pour tout ce qui est recommandé ci-dessous. Après votre réponse : je consigne chaque décision dans `QUESTIONS-ET-DECISIONS.md` (référence, date, valeur), j'ouvre un ADR si l'architecture ou la sécurité change, puis seulement j'exécute.

## Organisation prise en compte (précisée le 2026-11-02)
*Par fonctions, sans noms : le dépôt est public.*

- **Direction** : un CEO (qui dirige aussi la succursale Investudy) et une **DGA** (Deputy Managing Director), qui dirige le service financier et exerce aussi les fonctions **RH** ; leur rôle applicatif est « Direction » (la DGA y ajoute « RH », décision D27) : lecture seule dans le CRM.
- **Service financier** : le **DAF** (rôle « Finance »), supérieur d'un responsable de la conformité et du contrôle interne et d'une personne aux relations investisseurs ; le DAF rend compte à la DGA.
- **Service commercial** : un Head of Sales and Marketing (**Responsable commercial**) et **un seul chargé de compte**, avec un DevOps, un chargé de marketing digital et un infographiste (sans rôle métier dans le CRM).
- **Investudy** : succursale d'Investally ; **formateurs externes**, sans accès à l'application ; aucun responsable Investudy désigné.
- **Documents** : Investally émet tous les documents, avec une variante de logo pour Investudy ; devise XAF, TVA à 19,25 %.

**Conséquences déjà intégrées** : le DAF est le rôle « Finance » (FD-1, FD-2, FD-4) ; la DGA est la seconde validation naturelle (FD-2 B). **Nouvelles décisions** : FD-10 (contrôle interne) et FD-11 (formateurs, responsable Investudy).

## Feuille de réponse
| Réf. | Décision | Options | Ma recommandation | Bloque | **Votre choix** |
|---|---|---|---|---|---|
| **FD-1** | Quel événement rend une commission « due » ? | A/B/C/D | **B** | S4.4c (commissions à verser) | |
| **FD-2** | Contrôles du versement : déblocage, seuil, justificatif | A/B/C | **A** | S4.4c | |
| **FD-3** | Qui paie l'agrément : le client seul, ou parfois un tiers ? | A/B/C | **B** | Rien aujourd'hui ; coûte de plus en plus cher à changer (Investudy et la facturation liront ces champs) | |
| **FD-4** | Constat du paiement (« honoré ») et suivi des demandes d'agrément | A/B/C | **B** | Rien aujourd'hui ; conditionne FD-1 | |
| **FD-5** | Opportunités : retour en arrière d'étape et réouverture | A/B/C | **A (statu quo)** | Rien aujourd'hui | |
| **FD-6** | Changement de responsable d'une entreprise : faut-il un second facteur récent ? | A/B/C | **B** | Rien aujourd'hui | |
| **FD-7** | Confirmer les valeurs par défaut déjà appliquées (D22, D29 à D39) | Oui / Non, par ligne | **Tout confirmer** | Rien (risque de reprise) | |
| **FD-8** | Dossiers externes : Microsoft 365, second Super administrateur, avis juridique, contact Finance | Réponses à compléter | Lancer maintenant | La mise en production | |
| **FD-9** | Avant S5 : cas d'usage Investudy, apprenant distinct, droits du rôle Finance | Confirmer / corriger | **Confirmer** | S5 | |
| **FD-10** | Contrôle interne : qui lit le journal d'audit ? | A/B/C | **B** | Rien aujourd'hui ; la mise en production (avis juridique, D11) | |
| **FD-11** | Formateurs externes et responsable Investudy | A/B/C | **B** | S5 (Investudy) | |

## Ordre conseillé
1. **FD-1 et FD-2** débloquent S4.4c ; FD-4 conditionne FD-1.
2. **FD-3, FD-5, FD-6, FD-7** limitent le risque de reprise (plus on attend, plus la reprise coûte).
3. **FD-8** : les délais externes (Microsoft 365, juridique) se comptent en semaines ; à lancer dès maintenant.
4. **FD-10 et FD-11** viennent de l'organisation précisée le 2026-11-02 : FD-10 (contrôle interne) avant la production, FD-11 (formateurs, responsable Investudy) avant S5.

## Critères et pondération (fixés avant de noter)
Mêmes cinq critères pour toutes les décisions (extraits de la grille standard, § 3 de la méthode), pour ne pas pondérer au gré de l'option préférée. Les critères Maintenance, Expérience utilisateur et Accessibilité ne discriminent pas ici (ils sont traités dans « Impacts »).

| Critère | Poids |
|---|---|
| Valeur métier | 5 |
| Risque (sécurité, juridique, délai) | 5 |
| Cohérence (architecture, décisions passées) | 4 |
| Réversibilité | 4 |
| Coût et délai | 3 |
| **Maximum possible** | 21 × 5 = **105** |

*Score = Σ (note × poids), notes de 1 (défavorable) à 5 (favorable). Il aide, il ne remplace pas le jugement : un risque rédhibitoire l'emporte sur un bon score. Réversibilité : 🟢 facile · 🟡 moyenne · 🔴 coûteuse. Les faits vérifiés sont distingués des hypothèses.*

---

## FD-1 — Quel événement rend une commission « due » ?
*Références : Flux F3, S4.4c ; D24, D5, D112 · Bloque : S4.4c (commissions à verser)*

### 1. Contexte
Le facilitateur qui a apporté une entreprise touche une commission, versée par le chargé de compte après déblocage des fonds par le **DAF** (directeur administratif et financier, qui dirige le service financier) (D24). Il faut dire **à quel moment la commission devient « à verser »**. Sans cette réponse, S4.4c ne peut pas être construit.

**Faits vérifiés**
- L'agrément existe (S4.4a) ; il passe « honoré » à la main par le Responsable commercial (D112).
- Le CRM ne suit pas le paiement effectif : décision D5, séparation CRM / ERP (ADR-0005).
- Le module Finance (facturation, encaissement) n'existe pas encore.
- Organisation (précisée le 2026-11-02) : le DAF dirige le service financier et rend compte à la DGA ; le rôle applicatif du DAF est « Finance ».

**Hypothèses (à vérifier)**
- Le DAF ne veut pas verser avant d'avoir encaissé (à confirmer).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — À l'enregistrement de l'agrément (« reçu ») | Le facilitateur est payé dès la promesse signée ; rien à construire de plus. | On verse avant d'avoir encaissé : perte possible si le client ne paie pas. | UX : rapide. Métier : risque financier. Technique : une règle. Maintenance : faible. | 🟢 facile |
| **B** — Quand l'agrément est honoré (constaté à la main) | Utilise l'état « honoré » déjà livré ; le déblocage par le DAF reste un second contrôle. | Dépend d'un constat manuel fiable (aujourd'hui du Responsable commercial, du DAF si FD-4 = B) ; le paiement n'est pas vérifié par le CRM. | UX : un clic de plus pour le Responsable commercial. Technique : un événement interne. Maintenance : faible. | 🟢 facile (changer l'événement = une règle) |
| **C** — Quand le paiement est encaissé et constaté par la Finance | Aucun versement avant encaissement réel ; cohérent avec D5 et l'ERP. | Exige le module Finance (flux F4), qui n'existe pas : S4.4c serait repoussé. | Technique : événement venant de l'ERP (à concevoir). Délai : plusieurs sessions. | 🟡 moyenne |
| **D** — Statu quo : ne pas décider | Rien n'est versé par erreur ; aucun coût. | S4.4c reste bloqué ; les commissions se suivent hors de l'application. | Aucun changement. Dette : le suivi manuel persiste. | 🟢 facile |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** | **D** |
|---|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 5 | 1 |
| Risque (sécurité, juridique, délai) (5) | 1 | 3 | 5 | 4 |
| Cohérence (architecture, décisions passées) (4) | 2 | 4 | 5 | 2 |
| Réversibilité (4) | 4 | 4 | 3 | 5 |
| Coût et délai (3) | 5 | 4 | 1 | 5 |
| **Total (max 105)** | **59** | **79** | **85** | **68** |

### 4. Risques et dette
- **Risque** : Un constat « honoré » erroné déclenche une commission à tort (probabilité moyenne ; parade : second contrôle du DAF au déblocage, audit de chaque changement d'état).
- **Risque** : Le Responsable commercial oublie de constater l'honneur : la commission tarde (parade : liste des agréments « reçus » à honorer).
- **Dette** : Passage à C avec le module Finance (dette D112 déjà ouverte).

### 5. Recommandation
**B** maintenant, avec **C comme cible** quand le module Finance existera. La grille classe C en tête (85 sur 105), mais son coût et son délai sont rédhibitoires aujourd'hui : il repousserait S4.4c sans date. B est cohérent avec ce qui est livré, garde le DAF comme second contrôle au déblocage, et passer à C plus tard ne change **qu'une règle** (l'événement déclencheur). Ce qui me ferait changer d'avis : un module Finance planifié **avant** S4.4c (alors C), ou une décision de verser dès la promesse signée (alors A, que je déconseille).

*Écart assumé entre la grille et la recommandation : l'option C obtient le meilleur total (85), mais elle n'est pas recommandée pour la raison donnée ci-dessus.*

### 6. Décision attendue
**Votre choix pour FD-1** : ☐ A  ☐ B  ☐ C  ☐ D  ☐ autre : …………  — motif / réserves : ………………

---

## FD-2 — Contrôles du versement : déblocage, seuil, justificatif
*Références : Flux F3 (CU-F3-04, CU-F3-05), S4.4c ; D24 · Bloque : S4.4c*

### 1. Contexte
Une fois la commission « due », le **DAF débloque les fonds**, puis le chargé de compte **verse** et dépose un **justificatif**. Il faut décider **combien de validations** et **quel document**.

**Faits vérifiés**
- Le flux F3 propose : le DAF débloque (droit à créer, `bd.commission.release`), le chargé de compte verse (`bd.commission.pay`) et dépose le justificatif, le DAF clôt.
- La catégorie de document « Justificatif » existe déjà dans le module Documents.
- Organisation (précisée le 2026-11-02) : le DAF rend compte à la DGA, qui a le rôle Direction (lecture seule) ; une seconde validation par la DGA exige donc un **droit d'approbation dédié** (à créer), et le rôle Finance du DAF n'a aujourd'hui aucun droit sur les commissions (D8).

**Hypothèses (à vérifier)**
- Les montants de commission sont modestes ; aucun seuil n'a été exprimé.

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Le DAF seul débloque (flux F3 tel que proposé) — statu quo documentaire | Simple, conforme à D24 ; un seul acteur de contrôle. | Un seul contrôle pour tout montant. | Technique : deux permissions (`bd.commission.release` pour le DAF, `bd.commission.pay` pour le chargé de compte). Maintenance : faible. | 🟢 facile |
| **B** — Le DAF débloque ; au-delà d'un seuil, seconde validation de la DGA (sa supérieure hiérarchique) | Réduit le risque de fraude pour les gros montants ; reflète la hiérarchie réelle ; le seuil est un paramètre. | Plus lent pour les gros montants ; un seuil à fixer et à faire vivre ; la DGA (lecture seule) a besoin d'un droit d'approbation. | Technique : un état « à valider par la DGA », un droit d'approbation dédié et ses tests. Maintenance : moyenne. | 🟢 facile (seuil paramétrable) |
| **C** — Pas de déblocage : le chargé de compte verse directement, contrôle a posteriori | Le plus rapide. | Contredit D24 (déblocage par le DAF) ; un contrôle seulement après coup. | Technique : plus simple ; risque métier élevé. | 🟡 moyenne |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 4 | 3 | 3 |
| Risque (sécurité, juridique, délai) (5) | 3 | 4 | 1 |
| Cohérence (architecture, décisions passées) (4) | 5 | 5 | 1 |
| Réversibilité (4) | 4 | 4 | 3 |
| Coût et délai (3) | 4 | 3 | 5 |
| **Total (max 105)** | **83** | **80** | **51** |

### 4. Risques et dette
- **Risque** : Un seul contrôle : une erreur ou une fraude du DAF n'est pas détectée (parade : audit, justificatif obligatoire, seuil activable).
- **Dette** : Seconde validation par la DGA (état, droit d'approbation, seuil) à construire si besoin.

### 5. Recommandation
**A**. Il est le plus cohérent avec D24 et le moins coûteux (80 contre 83 pour B après prise en compte de l'organisation : la hiérarchie DAF → DGA rend B naturel et lui donne un point de cohérence de plus, sans suffire à le placer devant). B n'apporte de valeur que si de gros montants existent (hypothèse non vérifiée) ; **l'ajouter plus tard demandera un développement** (un état « à valider par la DGA » et un droit d'approbation), ce que j'avais présenté à tort comme gratuit. Ce qui me ferait changer d'avis : des commissions élevées, ou une exigence de contrôle interne ou d'audit externe (alors B, avec la DGA en seconde validation).

### 6. Décision attendue
**Votre choix pour FD-2** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

| Sous-décision | Choix possibles | Ma recommandation | Votre choix |
|---|---|---|---|
| FD-2.1 Justificatif attendu | a) reçu de virement · b) ordre de versement · c) l'un ou l'autre | c) l'un ou l'autre (catégorie « Justificatif » existante). | |
| FD-2.2 Commission modifiable après « due » | a) figée dès « due » · b) modifiable jusqu'au déblocage par le Responsable commercial · c) toujours modifiable | a) figée dès « due » : ce qui est dû ne bouge plus ; une erreur se corrige par annulation motivée. | |
| FD-2.3 Seuil de seconde validation par la DGA (si FD-2 = B) | montant en XAF à fixer, ou aucun | aucun (A). | |

---

## FD-3 — Qui paie l'agrément : le client seul, ou parfois un tiers ?
*Références : D2, D39 ; flux F1, F4 · Bloque : Rien aujourd'hui ; coûte de plus en plus cher à changer (Investudy et la facturation liront ces champs)*

### 1. Contexte
L'agrément est actuellement émis **par le client payeur seulement** (valeur par défaut D2). Dans la réalité, un **employeur, un organisme ou un bailleur** peut payer pour l'apprenant. Si c'est possible, il faut le modéliser **avant** que l'inscription (S5) et la facturation (F4) s'appuient sur l'agrément.

**Faits vérifiés**
- Aucun champ « payeur » n'existe dans l'agrément livré.
- Aucune réponse de la direction commerciale n'a été recueillie.

**Hypothèses (à vérifier)**
- Il arrive qu'un tiers paie (à vérifier : c'est la vraie question).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Client payeur seulement (statu quo) | Aucun développement ; modèle simple. | Si un tiers paie : contournements (notes libres), factures au mauvais nom. | Aucun impact maintenant ; ajout plus tard = migration et écrans. | 🟡 moyenne (champ à ajouter plus tard) |
| **B** — Champ « payeur » facultatif : le client par défaut, ou un tiers (nom et type : employeur, organisme, bailleur) | Couvre le besoin à faible coût ; ajoutable à la facture plus tard. | Un champ de plus à saisir ; pas de fiche complète du tiers. | Une colonne facultative, un champ de formulaire, un affichage. | 🟢 facile |
| **C** — Le tiers est une fiche à part entière (entité « payeur ») | Suivi complet, factures et relances au tiers. | Nouvelle entité sans module Finance pour l'exploiter ; sur-construction si le cas est rare. | Nouvelle table, droits, écrans, doublons. | 🔴 coûteuse |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 5 |
| Risque (sécurité, juridique, délai) (5) | 2 | 4 | 4 |
| Cohérence (architecture, décisions passées) (4) | 4 | 4 | 3 |
| Réversibilité (4) | 3 | 4 | 2 |
| Coût et délai (3) | 5 | 4 | 1 |
| **Total (max 105)** | **68** | **84** | **68** |

### 4. Risques et dette
- **Risque** : Le tiers saisi en texte libre est incohérent d'un agrément à l'autre (parade : liste fermée des types).
- **Dette** : Fiche « payeur » complète si la facturation l'exige.

### 5. Recommandation
**B**. C'est l'assurance la moins chère : un champ facultatif qui ne gêne personne si le tiers n'existe jamais, et évite une migration lourde si Investudy ou la facturation en ont besoin. Je vous demande en parallèle de **vérifier avec la direction commerciale** si un tiers paie parfois ; si la réponse est « jamais », A suffit. Ce qui me ferait changer d'avis : un besoin de factures ou de relances adressées au tiers (alors C, avec le module Finance).

### 6. Décision attendue
**Votre choix pour FD-3** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

---

## FD-4 — Constat du paiement (« honoré ») et suivi des demandes d'agrément
*Références : D5, D111, D112, D8 · Bloque : Rien aujourd'hui ; conditionne FD-1*

### 1. Contexte
Aujourd'hui, **le Responsable commercial constate à la main** qu'un agrément est honoré, et l'agrément naît directement « reçu » (pas d'état « demandé »). La question : **qui constate le paiement** et faut-il suivre une **demande d'agrément en attente** du client ?

**Faits vérifiés**
- Le paiement effectif relève de la Finance (D5, ADR-0005) : le DAF dirige le service financier.
- Le rôle Finance a des droits très limités dans le CRM (D8 ouvert).
- L'état « demandé » du flux F1 n'a pas été réalisé (D111).

**Hypothèses (à vérifier)**
- Le DAF est la personne qui sait si le client a payé (cohérent avec l'organisation précisée le 2026-11-02 ; à confirmer).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Statu quo : honoré à la main par le Responsable commercial ; pas d'état « demandé » | Rien à construire ; fonctionne tout de suite. | Le constat vient de quelqu'un qui n'encaisse pas ; les demandes en attente sont invisibles. | Aucun impact maintenant. | 🟢 facile |
| **B** — Honoré par le DAF (rôle Finance) + état « demandé » pour suivre les demandes en attente | Constat par qui sait ; suivi des promesses non encore signées. | Donne au rôle Finance un accès au CRM (D8) : lire les agréments et les commissions, constater l'honneur ; un état et un écran de plus. | Le droit `bd.approval.honor` passe du Responsable commercial au rôle Finance, qui reçoit aussi `bd.approval.read` ; un état, un filtre ; tests à étendre. | 🟢 facile |
| **C** — Le CRM suit le paiement (montants encaissés, échéances) | Vision complète des encaissements dans le CRM. | Contredit D5 et la séparation CRM / ERP ; double saisie avec la Finance. | Nouveau modèle de paiements ; maintenance lourde. | 🔴 coûteuse |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (sécurité, juridique, délai) (5) | 3 | 4 | 3 |
| Cohérence (architecture, décisions passées) (4) | 4 | 4 | 1 |
| Réversibilité (4) | 4 | 4 | 2 |
| Coût et délai (3) | 5 | 3 | 1 |
| **Total (max 105)** | **77** | **81** | **50** |

### 4. Risques et dette
- **Risque** : Le DAF n'utilise pas le CRM : les agréments restent « reçus » indéfiniment (parade : rappel, délégation au Responsable commercial).
- **Dette** : Suivi des encaissements dans le module Finance (F4).

### 5. Recommandation
**B**. La grille la place devant A de peu (81 contre 77, un écart qui reste dans la marge d'appréciation) ; je la recommande parce qu'elle aligne le constat du paiement sur la personne qui le connaît et rend FD-1 (B) plus fiable. Elle suppose de trancher **en même temps** les droits du rôle Finance dans le CRM (D8), faute de quoi A reste acceptable. Ce qui me ferait changer d'avis : si le DAF ne veut pas se connecter au CRM (alors A, et le constat reste au Responsable commercial).

### 6. Décision attendue
**Votre choix pour FD-4** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

---

## FD-5 — Opportunités : retour en arrière d'étape et réouverture
*Références : D36, S4.3a · Bloque : Rien aujourd'hui*

### 1. Contexte
Une opportunité avance d'une étape à la fois, **sans retour en arrière**, et une opportunité clôturée (gagnée ou perdue) est **définitive**. En pratique, une erreur de saisie ou un client qui revient peut vouloir l'inverse.

**Faits vérifiés**
- Les étapes ne reculent pas ; une clôture est immuable ; une erreur se corrige en clôturant et en recréant.
- Chaque passage et chaque clôture sont tracés dans l'audit.

**Hypothèses (à vérifier)**
- Les erreurs de saisie sont rares ; les clients qui reviennent sont plus fréquents (à vérifier).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Statu quo : ni retour en arrière, ni réouverture | Règles simples, pipeline fiable, audit propre. | Une erreur oblige à clôturer et recréer (perte de l'historique de l'opportunité). | Aucun impact. | 🟢 facile |
| **B** — Le Responsable commercial peut reculer d'un cran ou rouvrir, avec un motif tracé | Corrige les erreurs sans perdre l'historique. | Peut servir à contourner la règle de l'accord de principe ; plus de cas à tester. | Deux actions, un droit, des tests de règles. | 🟡 moyenne |
| **C** — Le chargé de compte peut reculer et rouvrir librement | Souplesse maximale. | Affaiblit le pipeline et l'accord de principe ; fiabilité des chiffres compromise. | Règles à relâcher partout. | 🟡 moyenne |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (sécurité, juridique, délai) (5) | 5 | 3 | 1 |
| Cohérence (architecture, décisions passées) (4) | 5 | 3 | 1 |
| Réversibilité (4) | 4 | 4 | 3 |
| Coût et délai (3) | 5 | 3 | 4 |
| **Total (max 105)** | **91** | **72** | **53** |

### 4. Risques et dette
- **Risque** : Frustration des utilisateurs en cas d'erreur de saisie (parade : message clair indiquant la marche à suivre).
- **Dette** : Aucune.

### 5. Recommandation
**A (statu quo)**. La grille et le jugement convergent : le pipeline ne vaut que s'il est fiable, et la correction par clôture puis recréation reste possible. Je ne changerais que si des erreurs fréquentes sont constatées en usage réel. Ce qui me ferait changer d'avis : plus de quelques corrections par mois (alors B).

### 6. Décision attendue
**Votre choix pour FD-5** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

---

## FD-6 — Changement de responsable d'une entreprise : faut-il un second facteur récent ?
*Références : D17, D37, D102, S4.3b · Bloque : Rien aujourd'hui*

### 1. Contexte
Changer le responsable d'une entreprise **transfère la visibilité** de ses contacts, offres, opportunités, rendez-vous et agréments. La décision D17 prévoyait une **confirmation du second facteur** ; la version livrée utilise une **simple case à cocher** (D102).

**Faits vérifiés**
- Le mécanisme de « second facteur récent » existe déjà (utilisé pour fermer toutes les autres sessions).
- Seul le Responsable commercial (et l'administrateur) peut réattribuer, dans son équipe.

**Hypothèses (à vérifier)**
- Une session volée pourrait vider le portefeuille d'un commercial (scénario peu probable, impact élevé).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Statu quo : case à cocher seulement | Rapide ; déjà livré. | Contredit D17 ; une session détournée suffit. | Aucun impact. | 🟢 facile |
| **B** — Second facteur récent demandé avant la réattribution, en plus de la case | Conforme à D17 ; protège un geste à fort effet. | Une étape de plus (quelques secondes) pour le Responsable commercial. | Réutilise le mécanisme existant ; tests à ajouter. | 🟢 facile |
| **C** — Motif obligatoire en texte, sans second facteur | Laisse une explication dans l'audit. | Ne protège pas contre une session détournée. | Un champ de plus. | 🟢 facile |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (sécurité, juridique, délai) (5) | 2 | 5 | 3 |
| Cohérence (architecture, décisions passées) (4) | 2 | 5 | 3 |
| Réversibilité (4) | 5 | 4 | 4 |
| Coût et délai (3) | 5 | 4 | 4 |
| **Total (max 105)** | **68** | **93** | **75** |

### 4. Risques et dette
- **Risque** : Friction pour le Responsable commercial (faible).
- **Dette** : Aucune.

### 5. Recommandation
**B**. Il est conforme à la décision D17, protège un geste à fort effet, et son coût est faible parce que le mécanisme existe. Ce qui me ferait changer d'avis : un retour d'usage montrant que l'étape gêne (alors C).

### 6. Décision attendue
**Votre choix pour FD-6** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

---

## FD-7 — Valeurs par défaut déjà appliquées, à confirmer
*Ce sont des recommandations de l'équipe appliquées faute de réponse. Les confirmer évite une reprise tardive ; en changer une est possible (coût variable). Répondez « confirmé » ou indiquez la correction.*

| Réf. | Lot | Valeur par défaut appliquée (résumé) | Votre réponse |
|---|---|---|---|
| D22 | S3.6 Documents | Formats PDF, JPG, PNG, DOCX, XLSX (macros refusées) ; 10 Mo maximum ; catégories Décharge, Contrat, Agrément signé, Justificatif, Facture, Autre ; aucune purge des archives. | ☐ confirmé  ☐ à changer : …… |
| D29 | S4.1a Contacts | Fonctions DAF, Décideur, Autre ; un contact appartient à une entreprise ; doublon signalé avec « Créer quand même » ; suppression réservée au Responsable commercial. | ☐ confirmé  ☐ à changer : …… |
| D30 | S4.1b Tableau | Tableau (et non cartes) pour les entreprises et les contacts ; cartes pour les opportunités. | ☐ confirmé  ☐ à changer : …… |
| D32 | S4.2a Offres | États brouillon, déposée, décharge reçue, acceptée, refusée, retirée ; modification en brouillon seulement ; retrait avec motif. | ☐ confirmé  ☐ à changer : …… |
| D33 | S4.2b Décharges | Une seule décharge valide par offre ; fichier signé obligatoire ; date ni future ni antérieure au dépôt ; annulation avec motif. | ☐ confirmé  ☐ à changer : …… |
| D34 | S4.2c Relances | Au plus trois relances par offre ; échéance proposée à sept jours ; résultat obligatoire pour terminer, motif pour annuler. | ☐ confirmé  ☐ à changer : …… |
| D35 | S4.2d Agenda | Trois types de rendez-vous ; 60 minutes ; jamais dans le passé ; conflit d'horaire = avertissement ; aucun rappel envoyé. | ☐ confirmé  ☐ à changer : …… |
| D36 | S4.3a Opportunités | Cinq étapes ; accord de principe avec rendez-vous décideur ou dérogation ; motifs de perte en liste fermée ; clôture gagnée par le Responsable commercial. *(retour en arrière : voir FD-5)* | ☐ confirmé  ☐ à changer : …… |
| D37 | S4.3b Statuts | Statut d'un cran avec retour ; « Qualifiée » exige un contact ; « Cliente » posée par l'agrément ; réattribution limitée à l'équipe. *(second facteur : voir FD-6)* | ☐ confirmé  ☐ à changer : …… |
| D38 | S4.3c Valeur | Valeur = opportunités ouvertes, par devise, non pondérée, selon le droit de lecture ; rendez-vous lié non modifiable ; règle de l'accord de principe précisée. | ☐ confirmé  ☐ à changer : …… |
| D39 | S4.4a Agréments | Montant et/ou places ; validité facultative, expiration manuelle ; un seul agrément actif par opportunité ; entreprise « Cliente » à l'enregistrement. *(payeur : FD-3 ; honoré et « demandé » : FD-4)* | ☐ confirmé  ☐ à changer : …… |

**Recommandation** : **tout confirmer**, sauf les points renvoyés vers FD-3 à FD-6.

## FD-8 — Dossiers externes à lancer
*Ce ne sont pas des choix techniques : il faut un nom, un responsable et une échéance. Chaque dossier bloque la **mise en production**, pas le développement.*

| Dossier | Pourquoi | Qui le porte ? | Pour quand ? | Votre réponse |
|---|---|---|---|---|
| **Microsoft 365** (D9) : locataire, application d'envoi, boîte dédiée, SPF / DKIM / DMARC | Aucun e-mail réel tant qu'il manque (invitations, réinitialisations) ; bloque la production | Administrateur M365 | | |
| **Deuxième Super administrateur nominatif** (D10) | Un seul compte : risque de verrouillage de l'administration | Direction | | |
| **Avis juridique** (D11) : conservation de l'audit, données des apprenants, contacts, facilitateurs, suivi des performances | Avant la production ; bloque le suivi des performances des employés | Juridique | | |
| **Réponses du DAF** (et de la DGA pour une seconde validation) | Répondre à FD-1, FD-2 et FD-4 (déblocage, justificatif, constat du paiement) | Le DAF | | |
| **Logos au format SVG** et charte graphique des documents | Fiche, offre, certificat, émargement, facture | Graphiste | | |

## FD-9 — Avant S5 (Investudy)
| Réf. | Question | Défaut proposé | Votre réponse |
|---|---|---|---|
| D31 | Valider les cas d'usage du module Investudy (flux I1 à I5) : confirmation des inscriptions par le Responsable Investudy seul, seuils de certificat (80 % de présence, 10 sur 20), annulation d'une session sans suppression des inscriptions | Confirmer tels que proposés (`CAS-D-USAGE-MODULE-INVESTUDY.md`) | ☐ confirmé  ☐ à changer : …… |
| D7 | L'apprenant est-il une entité distincte du contact, avec lien facultatif ? | Entité distincte | ☐ confirmé  ☐ à changer : …… |
| D8 | Droits fins du rôle Finance (le DAF) dans le CRM : lire les entreprises, les agréments et les commissions ; débloquer ; constater le paiement (selon FD-2 et FD-4) | Inchangé, ou élargi si FD-2 ou FD-4 l'exige | ☐ confirmé  ☐ à changer : …… |

---

## FD-10 — Contrôle interne : qui lit le journal d'audit ?
*Références : D11, D27 ; organisation (précisée le 2026-11-02) · Bloque : Rien aujourd'hui ; la mise en production (avis juridique, D11)*

### 1. Contexte
Le **responsable de la conformité et du contrôle interne** (RCCI) du service financier doit pouvoir vérifier ce qui s'est passé dans l'application. Le journal d'audit n'est lisible aujourd'hui que par le **Super administrateur** et la **Direction** (DG et DGA).

**Faits vérifiés**
- Le rôle Direction lit tout, y compris l'audit, sans rien écrire.
- Aucun rôle applicatif n'existe pour la conformité ; la lecture de l'audit par la Direction attend l'avis juridique (D11).

**Hypothèses (à vérifier)**
- Le contrôle interne doit rester indépendant de la direction qu'il contrôle (à confirmer).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Statu quo : le responsable de la conformité demande à la DGA ou au Super administrateur | Aucun développement. | Contrôle interne dépendant d'un tiers ; peu d'indépendance ; sollicitations répétées. | Aucun impact. | 🟢 facile |
| **B** — Un rôle de lecture « Conformité » : journal d'audit (portée Tous) et rien d'autre | Indépendance et moindre privilège : il lit l'audit sans lire le reste du CRM. | Un rôle de plus à maintenir ; soumis à l'avis juridique sur la lecture de l'audit. | Un rôle, une ligne de matrice, des tests de droits. | 🟢 facile |
| **C** — Lui donner le rôle Direction | Aucun nouveau rôle. | Accès à tout le CRM et à ses exports : bien au-delà du besoin ; brouille la frontière entre dirigeants et contrôle. | Aucun développement. | 🟢 facile |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 2 | 5 | 4 |
| Risque (sécurité, juridique, délai) (5) | 3 | 4 | 2 |
| Cohérence (architecture, décisions passées) (4) | 4 | 4 | 2 |
| Réversibilité (4) | 5 | 4 | 4 |
| Coût et délai (3) | 5 | 3 | 5 |
| **Total (max 105)** | **76** | **86** | **69** |

### 4. Risques et dette
- **Risque** : La lecture de l'audit peut être restreinte par l'avis juridique (D11) : le rôle serait créé mais inactif jusque-là.
- **Dette** : Rôle « Conformité » à documenter dans la matrice de droits.

### 5. Recommandation
**B**. Il répond au besoin avec le moindre privilège et sans confondre contrôle et direction. Ce qui me ferait changer d'avis : un avis juridique interdisant la lecture de l'audit hors Direction (alors A, ou une lecture sur demande tracée).

### 6. Décision attendue
**Votre choix pour FD-10** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

---

## FD-11 — Formateurs externes et responsable Investudy
*Références : Flux I3, S5 ; D31 ; organisation (précisée le 2026-11-02) · Bloque : S5 (Investudy)*

### 1. Contexte
Les **formateurs sont externes** à Investally et **sans accès à l'application** ; mais le flux I3 prévoit qu'ils saisissent présences et évaluations de leurs sessions (rôle « Formateur »). Par ailleurs, **aucun responsable Investudy** n'est désigné : Investudy est une succursale dirigée par le CEO, et le flux I1 à I5 compte sur un responsable pour confirmer les inscriptions.

**Faits vérifiés**
- Le rôle « Formateur » existe dans la matrice (ses sessions : présences et évaluations).
- Les formateurs peuvent être enregistrés dans l'application sans compte.
- Le CEO a le rôle Direction (lecture seule) ; le rôle « Responsable de formation » existe.

**Hypothèses (à vérifier)**
- Peu de formateurs, intervenant ponctuellement (à vérifier) ; le CEO exerce de fait la responsabilité d'Investudy (à confirmer).

### 2. Options
| Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|
| **A** — Statu quo : comptes « Formateur » limités à leurs sessions (flux I3 tel qu'écrit) | Saisie à la source ; traçabilité par formateur. | Comptes externes avec second facteur obligatoire ; contredit « sans accès » ; gestion des accès de personnes extérieures. | Gestion d'accès externes ; support ; périmètre « mes sessions ». | 🟡 moyenne |
| **B** — Pas de compte formateur : le responsable Investudy saisit présences et évaluations (feuille d'émargement fournie par le formateur) | Aucun accès externe ; conforme à l'organisation actuelle ; plus simple à construire. | Charge de saisie pour le responsable ; moins de traçabilité à la source. | Un flux plus court ; la saisie suit la portée du responsable. | 🟢 facile (les comptes peuvent s'ajouter plus tard) |
| **C** — Mixte : saisie par le responsable au départ, comptes formateurs ouverts plus tard à ceux qui le demandent | Souplesse ; démarre simple. | Deux modes à maintenir et à tester ; règles de bascule à définir. | Les deux chemins de saisie existent. | 🟢 facile |

### 3. Grille de comparaison
| Critère (poids) | **A** | **B** | **C** |
|---|---|---|---|
| Valeur métier (5) | 4 | 3 | 4 |
| Risque (sécurité, juridique, délai) (5) | 2 | 5 | 4 |
| Cohérence (architecture, décisions passées) (4) | 2 | 4 | 3 |
| Réversibilité (4) | 3 | 4 | 5 |
| Coût et délai (3) | 3 | 5 | 3 |
| **Total (max 105)** | **59** | **87** | **81** |

### 4. Risques et dette
- **Risque** : Charge de saisie sur le responsable Investudy (parade : saisie en lot depuis la feuille d'émargement).
- **Dette** : Comptes formateurs à ouvrir si le besoin apparaît.

### 5. Recommandation
**B**. Il épouse l'organisation (formateurs sans accès), supprime le risque lié aux comptes externes et reste réversible : le rôle « Formateur » existe déjà pour ouvrir des comptes plus tard. Ce qui me ferait changer d'avis : un nombre élevé de formateurs ou une exigence de saisie à la source (alors C).

### 6. Décision attendue
**Votre choix pour FD-11** : ☐ A  ☐ B  ☐ C  ☐ autre : …………  — motif / réserves : ………………

| Sous-décision | Choix possibles | Ma recommandation | Votre choix |
|---|---|---|---|
| FD-11.1 Qui est le responsable Investudy | a) le CEO (rôles Direction + Responsable de formation) · b) une autre personne à nommer | a) le CEO de fait, en cumulant les deux rôles, jusqu'à la nomination d'un responsable. | |

---

## Ce qui ne change pas
Les décisions déjà prises (D1 à D5 sauf FD-3 et FD-4, D18, D24, D27, D28…) ne sont pas rouvertes. Une décision n'est jamais effacée : si vous changez une valeur par défaut, j'ajoute « remplacée par » avec la date.
