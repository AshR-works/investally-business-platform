# Livrable 1 — Récapitulatif des réalisations

**Projet** : Investally Business Platform — CRM (Business Development + Investudy), puis ERP
**Période couverte** : du cadrage (S0) à S3.5 · **Date** : 2026-10-21
**Rédigé par** : Claude, avec l'ingénieur logiciel d'Investally · **Statut** : S0 à S3.3 validés et fusionnés ; S3.4 et S3.5 exécutés, **en attente de votre validation**

> Ce document dit **ce qui est fait, ce que ça prouve, et ce qui ne l'est pas**. Les commentaires de l'ingénieur (colonne ou encadré « Commentaire ») sont volontairement francs : un récapitulatif flatteur ne sert à personne.

---

## 1. En une page

**Ce qui existe aujourd'hui**
- Une **plateforme sécurisée de comptes et d'accès** : on peut inviter un collègue, il choisit son mot de passe, configure son second facteur (application d'authentification), se connecte, et ne voit que ce que son rôle et son périmètre autorisent.
- Un **premier module métier** (entreprises cibles du pipeline commercial) déjà protégé par ces règles.
- Un **bouton « Mot de passe oublié »** sécurisé et traçable, et la même réinitialisation déclenchable par un administrateur.
- Un **journal d'audit** inaltérable de toutes les actions sensibles.
- Une **interface web** : connexion, second facteur, activation d'invitation, administration des utilisateurs, mon compte.

**Ce que ça représente**
| Mesure | Valeur |
|---|---|
| Code de l'API (hors tests) | ≈ 8 800 lignes, **535 fonctions, classes et composants commentés** (API + interface) |
| Code de l'interface web | ≈ 1 800 lignes |
| Code de test | ≈ 4 500 lignes (API) + 220 (interface) |
| Tests automatiques | **380 unitaires + 141 d'intégration (API), 24 (interface)** — tous verts |
| Routes HTTP | 32 (dont 2 sondes de santé), **toutes** protégées ou explicitement publiques (vérifié par un test qui les parcourt) |
| Permissions / rôles | 99 permissions · 10 rôles · 3 portées (Propre, Équipe, Tous) |
| Base de données | 6 migrations, 24 modèles et énumérations, 3 schémas (`iam`, `audit`, `bd`) + `docs` |
| Documents | plus de 25 documents d'architecture, de sécurité et de recette, dont 6 décisions d'architecture (ADR) |

**Ce qui n'est pas fait (et vous devez le savoir)**
- Le **cœur métier** (pipeline commercial complet, Investudy, tableaux de bord) reste à construire : S4 à S6.
- L'envoi réel par **Microsoft 365** n'a jamais été testé (en attente de l'accès).
- Les écrans sont **vérifiés à la main** dans un navigateur, pas encore par des tests automatiques.
- Docker et l'intégration continue sont **écrits mais jamais exécutés** (S7).
- Aucun test de charge, aucune sauvegarde, aucune supervision : ce sont des sujets de mise en production (S7).

---

## 2. Sprint par sprint

| Sprint | Objectif | Ce qui a été livré | Preuve | Commentaire de l'ingénieur |
|---|---|---|---|---|
| **S0** Cadrage — *validé* | Décider avant de coder | Vision, architecture (contextes, glossaire, charge ≈ 20 utilisateurs), 4 premiers ADR, plan de sprints, risques, fiabilité | `docs/ARCHITECTURE.md`, `adr/0001-0004` | Le choix structurant : **monolithe modulaire** à frontières strictes. Pour 20 utilisateurs, des microservices seraient une dépense sans bénéfice. |
| **S1** Squelette — *validé* | Une tranche verticale qui marche | Monorepo, API + interface minimale, entreprise + audit, règles d'architecture automatiques | `SPRINT-1-RECETTE.md`, tag `s1-validated` | Le gain durable : **les règles d'architecture sont vérifiées par la CI**, pas par la bonne volonté. |
| **S2** Sécurité et données — *validé* | Le socle d'accès et d'audit | Catalogue de permissions, matrice des rôles, journal d'audit **en ajout seul et partitionné**, schéma de base, seed idempotent, identifiants UUID v7 | `SPRINT-2-RECETTE.md`, `RBAC.md` (généré du code) | Un **défaut d'horodatage** (décalage d'une heure selon le fuseau du serveur) a été trouvé et corrigé avec un test qui échoue sans le correctif. |
| **S3.1** Authentification — *validé* | Se connecter de façon sûre | Mot de passe **argon2id**, jetons **ES256**, sessions, rotation des jetons avec détection de rejeu, verrouillage progressif, limitation de débit, message d'échec unique | `SPRINT-3.1-RECETTE.md` | Toute la chaîne est testée contre les **courses** (tentatives simultanées sur un même compte) grâce à des verrous de ligne. |
| **S3.2** Second facteur — *validé* | MFA obligatoire pour tous | TOTP (algorithme **réimplémenté et validé sur les vecteurs officiels RFC 4226/6238**), secret chiffré AES-256-GCM, 10 codes de secours hachés, anti-rejeu, step-up, création du premier SuperAdmin sans mot de passe par défaut | `SPRINT-3.2-RECETTE.md` | Le choix de ne **jamais** livrer de mot de passe par défaut a un coût (un outil en ligne de commande) mais supprime le pire risque d'une première installation. |
| **S3.3** Autorisation et administration — *validé* | Qui peut quoi | `@Protected` (permission + portée + step-up), API utilisateurs/rôles/sessions, **invitation par lien à usage unique**, propriétaire des entreprises, garde-fou du **dernier SuperAdmin** | `SPRINT-3.3-RECETTE.md`, tag `s3-3-validated` | Trois défauts de conception trouvés **par les tests** avant de livrer (objet sans propriétaire, route trop permissive, invitation sans step-up). 8 « mutations » volontaires ont toutes été détectées. |
| **S3.4** Interface de base — *en attente* | Rendre l'ensemble utilisable | Connexion, MFA (QR généré dans le navigateur), codes de secours, activation d'invitation, administration, mon compte, en-têtes de sécurité | `SPRINT-3.4-RECETTE.md` | Un défaut grave n'est apparu **que dans un vrai navigateur** : un mauvais code MFA était compté deux fois contre le verrouillage. Corrigé des deux côtés. |
| **S3.5** Mot de passe oublié et livrables — *en attente* | Récupérer son accès sans compromettre la sécurité | Bouton « Mot de passe oublié », réinitialisation libre-service **et** par un administrateur, audit dédié, commentaires sur toutes les fonctions, présents livrables | `SPRINT-3.5-RECETTE.md` | Voir §4 : c'est la fonctionnalité la plus attaquée d'une application, donc la plus entourée de garde-fous. |

---

## 3. Ce que le système sait faire aujourd'hui (parcours)

| Parcours | Comment ça se passe | Où c'est testé |
|---|---|---|
| **Inviter un collègue** | L'administrateur saisit nom, adresse et rôles (MFA récent demandé). Un lien à usage unique de 48 h est envoyé ; aucun mot de passe n'existe avant que la personne ne le choisisse. | `admin-flows.integration.spec.ts`, recette réelle S3.4 |
| **Première connexion** | Mot de passe choisi via le lien → connexion → configuration obligatoire du second facteur (QR code) → 10 codes de secours affichés **une seule fois**. | `mfa-http`, recette réelle |
| **Connexion courante** | Mot de passe puis code à 6 chiffres. 5 échecs consécutifs : verrouillage progressif (1, 5, 15, 60 min). Message d'échec **identique** quel que soit le motif. | `auth-http`, `login.use-case` |
| **Voir ses entreprises** | Selon le rôle : *les siennes*, *celles de son équipe directe*, ou *toutes*. Hors périmètre : « introuvable » (on ne révèle pas l'existence). | `company-scope.spec.ts`, matrice de droits |
| **Administrer** | Liste, recherche, rôles, désactivation (coupe aussitôt les sessions), réinitialisation du MFA ou du mot de passe, coupure des sessions. Il reste **toujours** au moins un SuperAdmin. | `admin-use-cases.spec.ts`, courses sur la base |
| **Mot de passe oublié** | Lien sur la page de connexion → e-mail avec lien de 60 min → nouveau mot de passe → **toutes les sessions coupées**, e-mail de confirmation, **second facteur conservé**. | `password-reset.spec.ts` (27 tests), `password-reset.integration.spec.ts` (9), recette réelle |
| **Perte du téléphone** | Un code de secours à la connexion, ou un SuperAdmin réinitialise le MFA. | `mfa-management`, matrice |

---

## 4. Le « Mot de passe oublié » en détail (demande du 2026-10-21)

*Exigence : « exécuté de manière sécurisée et traçable ».*

**Sécurisé**
| Menace | Réponse |
|---|---|
| Deviner quelles adresses ont un compte | Réponse **strictement identique** (statut, texte, en-têtes) pour toute saisie ; le traitement a lieu **après** la réponse : le temps de réponse ne trahit rien |
| Inonder une boîte e-mail / force brute | 3 demandes par minute par couple IP + adresse ; **3 liens par heure par compte** |
| Vol ou rejeu du lien | 256 bits aléatoires, **seule l'empreinte** est stockée, **fragment d'URL** (jamais envoyé au serveur ni dans les en-têtes), **60 minutes**, **usage unique atomique**, un nouveau lien révoque les anciens |
| Détournement d'un lien d'invitation | Champ `purpose` : un lien d'invitation ne réinitialise pas un mot de passe, et inversement |
| Prise de contrôle du compte via la boîte e-mail | Le lien ne donne **aucun accès** : le **second facteur reste exigé** ; toutes les sessions sont coupées ; le titulaire reçoit un **e-mail de confirmation** avec l'adresse IP |
| Mot de passe faible ou réutilisé | Même politique que partout + refus des 5 derniers ; un refus **ne consomme pas** le lien |
| Abus d'un administrateur | Permission dédiée, **MFA récent exigé**, **interdit pour soi-même** |

**Traçable** — une action d'audit dédiée `PASSWORD_RESET` enregistre, avec l'adresse IP et l'appareil : chaque demande et son issue (`ISSUED`, `UNKNOWN`, `INELIGIBLE`, `THROTTLED`, `EMAIL_FAILED`), chaque émission par un administrateur (qui, pour qui), chaque usage, et chaque lien refusé (motif interne). **Jamais** le jeton, le mot de passe ni une adresse saisie qui ne correspond à aucun compte.

**Vérifié** : 27 tests unitaires, 9 tests HTTP sur base réelle (dont la course de deux usages simultanés du même lien, la comparaison des réponses « compte connu / inconnu », le plafond horaire), et un parcours réel dans le navigateur (demande → lien → refus du mot de passe réutilisé → succès → ancien mot de passe refusé, nouveau accepté, 3 lignes d'audit).

> **Commentaire** — *Le point faible assumé* : quelqu'un qui connaît une adresse peut redemander des liens et invalider celui de la victime (3 fois par heure au plus). C'est une nuisance, pas une intrusion ; elle est tracée (dette D25). Je préfère cette limite à l'alternative (ne rien plafonner), qui permettrait d'inonder une boîte.

---

## 5. Sécurité : mesures en place

| Domaine | Mesure | Preuve |
|---|---|---|
| Mots de passe | argon2id (19 Mio, 2 passes), politique 12 caractères + liste de mots courants + pas d'identité, historique des 5 derniers | tests unitaires |
| Jetons | JWT **ES256** à clé asymétrique (l'ERP pourra vérifier sans secret partagé), 15 min, **aucune permission dedans** (relue en base à chaque requête) | `es256-access-token.service` |
| Sessions | 15 min d'accès / 8 h d'inactivité / 7 jours (12 h pour SuperAdmin, Direction, Finance) ; rotation avec détection de rejeu | tests de rotation et de rejeu |
| MFA | Obligatoire pour **tous** ; secret chiffré AES-256-GCM lié à l'utilisateur ; anti-rejeu ; step-up de 10 min pour les actions sensibles | vecteurs RFC, tests HTTP |
| Autorisation | Refus par défaut ; matrice rôles × routes testée exhaustivement ; **IDOR** neutralisé (404 hors périmètre) | `rbac-http.integration.spec.ts` |
| Intégrité de l'administration | Pas d'auto-attribution de rôle ; **dernier SuperAdmin protégé** y compris sous concurrence ; pas de cycle hiérarchique | courses testées + mutations |
| Audit | Journal en ajout seul (la base refuse modification et suppression), partitionné par mois, conservation prévue 10 ans | triggers + tests |
| Injection / XSS / CSRF | Requêtes paramétrées ; React échappe ; aucune entrée HTML brute ; CSP, `frame-ancestors 'none'`, contrôle d'origine global | greps + tests |
| Fuites | Aucun hachage, secret ni jeton dans les réponses, les journaux ou l'audit ; erreurs de base journalisées **sans valeurs** | greps de sécurité, tests |
| Secrets | `.env` jamais versionné ; refus de démarrer en production avec une configuration dangereuse | tests de configuration |
| Chaîne logicielle | Dépendances épinglées ; `pnpm audit` : 0 vulnérabilité haute | audit à chaque sprint |

---

## 6. Qualité : comment on sait que ça marche

1. **Recette avant validation** : chaque sprint a un plan de recette signé ; aucun sprint n'est fusionné sans votre « Je valide ».
2. **Tests en trois étages** : unitaires (règles), intégration sur **base PostgreSQL jetable** (courses, droits, audit), **parcours réels dans un navigateur**.
3. **Mutations volontaires** : on casse exprès un contrôle de sécurité et on vérifie qu'un test échoue (24 mutations à ce jour ; **une seule a survécu** — un test trop faible sur le mot de passe oublié — et a été corrigée, voir la recette S3.5). C'est la seule façon de savoir qu'un test « garde » vraiment quelque chose.
4. **Règles d'architecture exécutées** par la CI (0 violation sur 129 modules).
5. **Documents générés du code** (matrice des droits, index des fonctions) : ils ne peuvent pas mentir.

## 7. Défauts rencontrés (et ce qu'ils enseignent)

| # | Défaut | Trouvé par | Enseignement |
|---|---|---|---|
| 1 | Horodatages décalés d'une heure selon le fuseau du serveur | test d'intégration | Forcer l'UTC ; garder un serveur de test en fuseau « difficile » |
| 2 | Objet sans propriétaire traité comme une simple liste (accessible à tort) | revue de conception avant le code métier | `undefined` ≠ `null` : le modèle de droits doit distinguer « collection » et « objet orphelin » |
| 3 | Route d'administration ouverte à un rôle à portée « propre » | matrice rôle × route | Ajout de `minScope` : une route qui agit sur *n'importe qui* exige la portée Tous |
| 4 | Invitation avec rôles sans droit d'attribution ni MFA récent | revue de sécurité | Une session détournée aurait pu inviter un SuperAdmin |
| 5 | **Mauvais code MFA compté deux fois** (le client rejouait la requête) | journal réseau d'un vrai navigateur | Aucun test automatique ne pouvait le voir : **la recette réelle est irremplaçable** |
| 6 | Codes de secours perdus par un simple rechargement de page | recette réelle | Avertissement avant de quitter + régénération possible |
| 7 | Outil de mutation qui laissait du code muté | contrôle immédiat | Un outil de test est du code : il se teste aussi |
| 8 | Test de plafond horaire fragile (frontière d'une heure exacte) | exécution | Les bornes de temps se testent **à la milliseconde** |

## 8. Dette et limites connues

Registre complet : `docs/TECH-DEBT.md` (27 entrées). Les plus importantes :

| Réf. | Sujet | Quand |
|---|---|---|
| D20 | CSP avec `'unsafe-inline'` pour les scripts (limite de Next.js sans nonce) | S7 |
| D22 | Parcours d'écrans non automatisés (vérifiés à la main) | S7 |
| D16 | Changer le responsable d'un utilisateur change qui voit quoi, sans MFA récent | décision attendue |
| D17 | Entreprises antérieures à S3.3 sans propriétaire ; pas de réattribution | S4.1 |
| D25 | « Mot de passe oublié » : nuisance possible par redemandes répétées | S6.2 |
| D26 | Traitement « mot de passe oublié » en mémoire (une panne entre réponse et envoi perd la demande) | selon besoin |
| — | Microsoft 365 non testé en réel ; Docker/CI jamais exécutés ; aucune sauvegarde | S7 / dès l'accès M365 |

## 9. Décisions prises et à prendre

**Prises** (registre `QUESTIONS-ET-DECISIONS.md`) : CRM séparé de l'ERP et prioritaire ; MFA pour tous ; SuperAdmin accès complet ; équipe = subordonnés directs ; e-mail Microsoft 365 ; audit conservé 10 ans ; agrément = promesse de paiement ; apprenant sans accès au CRM ; sprints d'une semaine ; bouton « Mot de passe oublié » (2026-10-21).

**À prendre**
| Décision | Pourquoi maintenant | Ma recommandation |
|---|---|---|
| Valider S3.4 et S3.5 | Pour les fusionner dans `main` | Valider ensemble après lecture de leurs recettes |
| Accès Microsoft 365 (locataire, application, boîte d'expédition) | Sans lui, aucun e-mail réel (invitations, mot de passe oublié) | À fournir avant toute mise à disposition des collègues |
| Deux futurs SuperAdmin nominatifs | Un seul compte = risque de blocage total | Désigner dès maintenant |
| MFA récent pour changer un responsable (D16) | Cela modifie les périmètres de visibilité | Oui |
| Validation juridique de la conservation de l'audit | Obligation avant production | À lancer en parallèle |
| Anciennes copies du dossier dans OneDrive | Risque de confusion de versions | Supprimer après votre accord |

## 10. Suite proposée

1. **S3.6 Documents** (téléversement, versions, empreinte SHA-256, traçabilité).
2. **Cadrage UX** : maquettes validées avec vous **avant** de coder les écrans du pipeline commercial.
3. **S4.1 → S4.4** : entreprises, contacts, offres, relances, rendez-vous, opportunités, agrément, ambassadeurs.
4. **S5** : Investudy. **S6** : tableaux de bord. **S7** : durcissement et mise en production.

## 11. Pour aller plus loin

| Document | Contenu |
|---|---|
| [02-GUIDE-DU-CODE.md](02-GUIDE-DU-CODE.md) | Où vit chaque chose, chemin d'une requête, recettes du développeur |
| [03-INDEX-DES-FONCTIONS.md](03-INDEX-DES-FONCTIONS.md) | Les 535 fonctions, classes et composants commentés, avec leur rôle |
| [04-SUIVI-DES-SESSIONS.md](04-SUIVI-DES-SESSIONS.md) | Historique session par session : demandes, décisions, validations, défauts, actions en attente |
| [05-ETAT-D-AVANCEMENT.md](05-ETAT-D-AVANCEMENT.md) | Tableau de bord : avancement du plan, santé, risques, décisions attendues |
| `docs/SECURITY.md` | Politique de sécurité détaillée (§2.7 : mot de passe oublié) |
| `docs/RBAC.md` | Matrice complète rôles × permissions (générée) |
| `docs/SPRINT-*-RECETTE.md` | Plans de recette et résultats, sprint par sprint |
| `docs/QUESTIONS-ET-DECISIONS.md` | Registre des décisions et questions ouvertes |
