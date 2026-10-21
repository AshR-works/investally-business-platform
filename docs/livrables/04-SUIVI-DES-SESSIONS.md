# Livrable 4 — Suivi des sessions de travail

**Projet** : Investally Business Platform · **Période** : du 2026-10-20 (16 h 30) au 2026-10-21 · **Mis à jour** : 2026-10-21
**Source** : historique Git (dates réelles des commits, des fusions et des étiquettes), plans de recette, registre des décisions et échanges avec la direction produit.

> **Comment lire ce document** — une *session* est un sprint mené par l'ingénieur logiciel d'Investally et Claude. Chaque fiche dit **ce qui était demandé, ce qui a été livré, ce qui a été validé (et par qui), ce qui a mal tourné et ce qui est reporté**. Rien n'y est arrondi : un suivi flatteur ne permet pas de décider.

---

## 1. Vue d'ensemble

| Session | Branche | Premier → dernier commit (UTC+1) | Fusion dans `main` | Étiquette | Validation |
|---|---|---|---|---|---|
| **S0** Cadrage | `master`/`main` | 10-20 16 h 30 | — (directement, avant la règle des branches) | — | ✅ « Commit et passons au S1 » |
| **S1** Squelette CRM | `sprint/s1-skeleton` | 10-20 17 h 37 → 19 h 03 | 10-20 19 h 05 (`9f53643`) | `s1-validated` | ✅ « Je valide S1, passe à S2 » — **avec réserves** (Docker et CI non exécutés) |
| **S2** Sécurité et données Core | `sprint/s2-security-core` | 10-20 19 h 15 → 20 h 26 | 10-20 20 h 28 (`b49a152`) | `s2-validated` | ✅ « Je valide S2, passe à S3.1 » |
| **S3.1** Authentification | `sprint/s3-1-authentication` | 10-20 20 h 50 | 10-20 20 h 54 (`dd21841`) | `s3-1-validated` | ✅ « Je valide S3.1, passe à S3.2 » |
| **S3.2** Second facteur | `sprint/s3-2-mfa` | 10-20 21 h 24 | 10-20 21 h 31 (`43f35ea`) | `s3-2-validated` | ✅ « Je valide S3.2, passe à S3.3 » |
| **S3.3** Autorisation et administration | `sprint/s3-3-authorization` | 10-20 21 h 43 → 22 h 05 | 10-20 22 h 15 (`420456b`) | `s3-3-validated` | ✅ « Je valide S3.3, passe à S3.4 » |
| **S3.4** Interface de base | `sprint/s3-4-front` | 10-20 22 h 40 → 22 h 58 | **fusionnée** (`s3-4-validated`) | — | ✅ **validée 2026-10-21** |
| **S3.5** Mot de passe oublié, commentaires, livrables | `sprint/s3-5-password-reset` | 10-21 05 h 39 | **fusionnée** (`s3-5-validated`) | — | ✅ **validée 2026-10-21** |
| **A11Y-1** Accessibilité (lecteurs d'écran) | `sprint/a11y-1-lecteurs-d-ecran` | 10-21 | **fusionnée** (`a11y-1-validated`) | — | ✅ **validée 2026-10-21** |
| **Cadrages** H1, H2, S3.6, UX | `sprint/h1-cadrage` | 10-21 | **fusionnée** (`cadrages-validated`) | — | ✅ **validée 2026-10-21** (11 décisions, D19) |
| **H1** Habillage minimal et hub | `sprint/h1-habillage-hub` | 10-21 | **fusionnée** | tests web 35/35, axe 21 états à 0 violation, CSP 0 violation | ✅ **validée 2026-10-21** (`h1-validated`) |
| **H1b** Composants de données | `sprint/h1b-composants-de-donnees` | 10-21 | **fusionnée** | tests web 42/42, axe 24 états à 0 violation, CSP 0 violation | ✅ **validée 2026-10-21** (`h1b-validated`) |
| **Arbitrage D21** données de l'API des entreprises | `sprint/arbitrage-api-donnees` | 10-22 | **fusionnée** (`d21-validated`) | tests web 43/43 | ✅ **validée 2026-10-22** |
| **H2a** Écrans d'accès | `sprint/h2a-ecrans-d-acces` | 10-22 | **fusionnée** | tests web 56/56, axe 29 états à 0 violation, CSP 0 violation | ✅ **validée 2026-10-22** (`h2a-validated`) |

> **Commentaire** — Les dates de commits ne mesurent pas l'effort : chaque session regroupe de longs échanges, des recettes et des corrections avant le commit final. Elles prouvent en revanche l'**ordre** et la **traçabilité** : aucune fusion sans validation écrite, aucune branche sautée. Le plan annonçait « 1 semaine maximum par sprint » ; l'ensemble tient ici en **moins de deux jours calendaires** parce que le rythme réel a été celui des validations successives de l'ingénieur.

**Règles de conduite tenues depuis S0**
1. Jamais de commit direct sur `main` (décidé après la question « Est-ce judicieux de commit sur master ? »).
2. Recette exécutée **avant** toute demande de validation.
3. Validation **explicite** (« Je valide Sx ») avant fusion `--no-ff` et étiquette `sN-validated`.
4. Registre des décisions tenu à jour à chaque sprint.
5. Dépôt hors OneDrive (`C:\dev\investally-platform`), ancienne copie **non supprimée** sans votre accord.

---

## 2. Fiches de session

### S0 — Cadrage (2026-10-20, ≈ 16 h 30)
| | |
|---|---|
| **Déclencheur** | « PROMPT MAÎTRE » : plateforme CRM + ERP, centre de formation Investudy, architecture propre, migrable vers .NET ; travail par sprints |
| **Livré** | Vision, architecture (contextes, glossaire, charge, décisions de données), plan de sprints, sécurité, risques (R1–R15), fiabilité, stratégie de test, ADR 0001-0004 |
| **Décisions** | Monolithe modulaire ; Prisma confiné à l'infrastructure ; entités du domaine distinctes des modèles de persistance ; audit par événements |
| **Échanges clés** | « Allons y » · « Continuons » · « Continue et termine le sprint 0 » · **« Est-ce judicieux de commit sur master ? »** → adoption des branches `sprint/*` |
| **Validation** | « Commit et passons au S1 » |
| **Commentaire** | Session purement documentaire. Sa valeur est de n'avoir pas codé avant d'avoir fixé les frontières. |

### S1 — Squelette CRM (2026-10-20, 17 h 37 → 19 h 05)
| | |
|---|---|
| **Déclencheur** | « Passons au S1 », puis **« le CRM doit être séparé de l'ERP et il est notre priorité »** |
| **Livré** | Monorepo pnpm ; API NestJS et interface Next.js minimale ; première tranche verticale « Entreprise » avec audit ; règles d'architecture exécutées par la CI (dependency-cruiser) ; **base PostgreSQL de test jetable** (demandée : « Produis une BD test générique ») |
| **Décisions** | ADR-0005 : CRM séparé de l'ERP, une base par produit ; périmètre CRM = pipeline commercial **+ Investudy complet** (réponse à la question posée) |
| **Exigence de la direction** | « Une fois l'architecture paramétrée on procédera aux tests avant de valider la session » → plan de recette systématique |
| **Défauts trouvés** | **Horodatages décalés d'une heure** selon le fuseau du serveur (corrigé : session forcée en UTC + test qui échoue sans le correctif) ; encodage WIN1252 de la base de test (UTF-8 imposé) ; dépendances ESM-only incompatibles (versions épinglées) |
| **Validation** | « Je valide S1, passe à S2 » — **avec réserves** : Docker et pipeline CI écrits mais jamais exécutés (dette consignée) |
| **Reporté** | Exécution réelle de Docker et de la CI → S7 |

### S2 — Sécurité et données Core (2026-10-20, 19 h 15 → 20 h 28)
| | |
|---|---|
| **Déclencheur** | « Je valide S1, passe à S2 » |
| **Livré** | Catalogue de permissions et matrice des rôles (document **généré** du code) ; journal d'audit **en ajout seul, partitionné par mois**, avec déclencheurs de base ; schémas `iam`, `docs` ; seed idempotent ; identifiants UUID v7 |
| **Échanges clés** | « Quelles questions ? » → **registre des questions sensibles** ; « Déplace le dépôt vers `C:\dev` » ; « Explique-moi pas à pas ces questions » ; **réponses de la direction** (ci-dessous) ; « Rajoute un document avec ces questions sensibles » ; « La copie dans `c:/dev` est-elle réussie ? » |
| **Décisions de la direction** | Ajout du rôle **TRAINING_MANAGER** ; **SuperAdmin = accès complet** ; équipe = **subordonnés directs** ; **MFA obligatoire** ; durées de session ; e-mail **Microsoft 365** ; audit **10 ans** ; **agrément = promesse de paiement** ; apprenant sans accès au CRM ; ambassadeur manuel ; charge ≈ **20 utilisateurs** ; sprints d'**une semaine maximum** ; recommandations appliquées jusqu'à la question 17 → **ADR-0006** |
| **Preuves** | 35/35 tests unitaires · 25/25 tests d'intégration |
| **Validation** | « Je valide S2, passe à S3.1 » |
| **Commentaire** | C'est la session où les **règles du jeu** ont été fixées. Deux interprétations de ma part restent à confirmer (MFA pour *tous* les rôles ; apprenant = entité distincte du contact). |

### S3.1 — Authentification (2026-10-20, ≈ 20 h 50)
| | |
|---|---|
| **Livré** | Mots de passe **argon2id** ; jetons **ES256** (clé asymétrique, aucune permission dedans) ; sessions (15 min / 8 h d'inactivité / 7 jours, 12 h pour les rôles privilégiés) ; **rotation des jetons avec détection de rejeu** ; verrouillage progressif ; limitation de débit ; message d'échec unique ; audit des connexions |
| **Échanges clés** | « À quel niveau allons-nous nous pencher sur le front-end ? » → proposition : **écrans livrés avec chaque sprint**, cadrage UX avant S4.1 ; « Où en est l'ensemble des processus ? » (point d'étape) |
| **Preuves** | Architecture : 92 modules, 287 dépendances, **0 violation** ; tests ciblés sur les **courses** (tentatives simultanées sur un même compte, verrous de ligne) |
| **Validation** | « Je valide S3.1, passe à S3.2 » |
| **Commentaire** | Premier sprint où une faute de conception aurait été grave ; chaque échec est **persisté après validation de la transaction** (sinon le compteur de verrouillage serait annulé avec elle). |

### S3.2 — Second facteur et amorçage (2026-10-20, ≈ 21 h 24)
| | |
|---|---|
| **Livré** | **TOTP** réimplémenté et validé sur les **vecteurs officiels RFC 4226 / 6238 / 4648** ; secret chiffré **AES-256-GCM** lié à l'utilisateur ; 10 codes de secours hachés ; anti-rejeu ; **step-up** (10 min) ; port d'e-mail avec adaptateur **Microsoft 365** (jamais testé en réel) ; création du premier SuperAdmin par ligne de commande, **sans mot de passe par défaut** |
| **Défauts trouvés** | Tests TOTP instables à la frontière de 30 s (rendus déterministes) ; mot de passe d'exemple faible refusé par la politique (le test a été corrigé, pas la règle) |
| **Preuves** | **277 unitaires + 91 intégration** · 110 modules, 367 dépendances, 0 violation |
| **Validation** | « Je valide S3.2, passe à S3.3 » |
| **Dette ouverte** | D13 « première inscription au MFA protégée par le seul mot de passe » → soldée en S3.3 par l'invitation |

### S3.3 — Autorisation et administration (2026-10-20, 21 h 43 → 22 h 15)
| | |
|---|---|
| **Livré** | `@Protected` (permission + portée + step-up) ; API utilisateurs, rôles, sessions ; **invitation par lien à usage unique de 48 h** ; propriétaire des entreprises ; garde-fou du **dernier SuperAdmin** y compris sous concurrence |
| **Ajustement du plan** | S3.3 devient « backend » ; le front passe en S3.4 (une semaine ne suffit pas à tout faire avec rigueur) |
| **Défauts trouvés** | Objet sans propriétaire traité comme une liste (`undefined` ≠ `null`) ; route d'administration ouverte à un rôle à portée « propre » (ajout de `minScope`) ; invitation sans droit d'attribution ni MFA récent (revue de sécurité) ; incident de mon outil de mutation (code muté laissé en place, réparé et corrigé) |
| **Preuves** | **353 unitaires + 130 intégration** · test qui parcourt **toutes** les routes · matrice 10 rôles × 16 routes · 8 mutations détectées · parcours réel sur le serveur compilé |
| **Validation** | « Je valide S3.3, passe à S3.4 » |

### S3.4 — Interface de base (2026-10-20, 22 h 40 → 22 h 58) — **validée le 2026-10-21 (tag `s3-4-validated`)**
| | |
|---|---|
| **Livré** | Connexion, second facteur (QR généré dans le navigateur), codes de secours, activation d'invitation, administration des utilisateurs, mon compte (mot de passe, codes, sessions), en-têtes de sécurité |
| **Défaut grave trouvé** | **Un mauvais code MFA était compté deux fois** contre le verrouillage (le client rejouait la requête). Invisible aux tests automatiques ; trouvé en lisant le journal réseau d'un vrai navigateur ; corrigé des deux côtés |
| **Autres défauts** | Page d'administration affichée sans droit ; codes de secours perdus au rechargement (avertissement ajouté) ; libellé d'appareil illisible ; tableau trop haut sur téléphone ; clé de chiffrement de test régénérée par mon fait |
| **Preuves** | 353 + 132 (API) · **24** (interface) · 4 mutations détectées · parcours réels dans un navigateur (dont le **step-up réel** après 10 min) |
| **Reste** | Validation de l'ingénieur ; D16 (MFA récent pour changer un responsable) à trancher |

### S3.5 — Mot de passe oublié, commentaires et livrables (2026-10-21) — **validée le 2026-10-21 (tag `s3-5-validated`)**
| | |
|---|---|
| **Déclencheur** | « Rajouter le parcours mot de passe est-il pertinent ? » → « Quelle est la méthode actuelle ? » (**aucune**) → « Allons-y » → **« Rajoute un bouton mot de passe oublié qui devra s'exécuter de manière sécurisée et traçable »** |
| **Autres demandes** | « Fais des livrables pour récapituler les réalisations avec commentaires, rajoute des commentaires sur les différentes fonctions » · **« Produis des livrables présentant l'état des réalisations et le suivi des sessions »** (le présent document) |
| **Livré** | Bouton « Mot de passe oublié » ; réinitialisation **libre-service** (lien 60 min, réponse identique pour toute adresse, plafonds, audit dédié) **et** par un **administrateur** (lien 48 h, MFA récent, jamais pour soi) ; MFA conservé, sessions coupées, e-mail de confirmation ; **535 fonctions commentées** ; livrables `docs/livrables/` |
| **Preuves** | **380 unitaires + 141 intégration** · 24 (interface) · 12 mutations (11 détectées d'emblée, **1 survivante corrigée**) · parcours réel dans le navigateur |
| **Défauts / incidents** | Tests d'intégration trop impatients (traitement volontairement asynchrone) ; mutant survivant (usage croisé d'un lien d'invitation) ; **4 échecs de délai** lors d'un passage sous charge, **non reproduits** (141/141 au calme) ; le navigateur intégré suspend le réseau quand son panneau est masqué |
| **Reste** | Validation après S3.4 ; Microsoft 365 non testé ; D25-D27 |

---

## 3. Chronologie des décisions et demandes de la direction produit

| Moment | Demande ou décision | Traitement |
|---|---|---|
| S0 | Prompt maître, « Allons y », « Continuons », « Continue et termine le sprint 0 » | Cadrage complet |
| S0 | « Est-ce judicieux de commit sur master ? » | **Branches `sprint/*`**, fusion `--no-ff`, étiquettes |
| S1 | « CRM séparé de l'ERP, notre priorité » + périmètre « Pipeline + Investudy complet » | ADR-0005 |
| S1 | « Les tests/recette avant de valider la session » | Plan de recette à chaque sprint |
| S1 | « Produis une BD test générique » | Base jetable + 25 entreprises génériques |
| S2 | « Quelles questions ? » / « Explique pas à pas » | Registre des questions et recommandations |
| S2 | « Déplace le dépôt vers `C:\dev\investally-platform` » | Fait ; copie OneDrive conservée (suppression soumise à votre accord) |
| S2 | Réponses Q1–Q11 + « applique tes recommandations jusqu'à Q17 » + charge ≈ 20 utilisateurs + sprints ≤ 1 semaine | ADR-0006, registre mis à jour |
| S2 | « Rajoute un document avec ces questions sensibles » | `QUESTIONS-ET-DECISIONS.md` |
| S3.1 | « À quel niveau le front-end ? » | Front livré par sprint (S3.4), cadrage UX avant S4.1 |
| S3.1 | « Où en est l'ensemble des processus ? » | Point d'étape complet |
| S3.4 → S3.5 | « Rajouter le parcours mot de passe est-il pertinent ? » | Analyse (3 options) et recommandation |
| S3.5 | « Un bouton mot de passe oublié sécurisé et traçable » | Libre-service **et** administrateur (SECURITY.md §2.7) |
| S3.5 | « Livrables + commentaires dans le code » | 535 fonctions commentées, livrables 1 à 3 |
| S3.5 | « Livrables : état des réalisations et suivi des sessions » | Livrables 4 et 5 |

---

## 4. Suivi cumulé de la qualité

| Étape | Tests unitaires (API) | Tests d'intégration (API) | Tests interface | Architecture (modules / violations) |
|---|---|---|---|---|
| S1 | non consigné | non consigné | — | contrôle en place |
| S2 | 35 | 25 | — | 0 violation |
| S3.1 | non consigné | non consigné | — | 92 modules · 0 |
| S3.2 | 277 | 91 | — | 110 modules · 0 |
| S3.3 | 353 | 130 | — | 127 modules · 0 |
| S3.4 | 353 | 132 | 24 | 128 modules · 0 |
| **S3.5 (état actuel)** | **380** | **141** | **24** | **129 modules · 0** |

> **Commentaire** — Deux cases « non consigné » : les premières recettes ne totalisaient pas les tests. Corrigé à partir de S2 (chaque recette donne désormais ses totaux). La progression 35 → 380 tests unitaires en six sessions suit celle du périmètre ; ce qui compte davantage est que **chaque défaut trouvé a laissé un test derrière lui**.

## 5. Défauts : bilan des sessions

| Session | Défauts trouvés | Trouvés par | Gravité potentielle |
|---|---|---|---|
| S1 | 3 | recette réelle, tests | moyenne (horodatages) |
| S2 | — | — | — |
| S3.1 | aucun consigné | — | — (le risque principal, des échecs annulés avec la transaction, avait été écarté dès la conception) |
| S3.2 | 2 | tests | faible |
| S3.3 | 4 | revue de conception, matrice, revue de sécurité | **élevée** (IDOR potentiel, invitation d'un SuperAdmin) |
| S3.4 | 6 | **navigateur réel** | **élevée** (verrouillage doublé) |
| S3.5 | 6 (dont 1 incident d'outil et 1 fragilité d'environnement) | mutations, exécution | moyenne |

**Enseignement transversal** : les défauts graves ont été trouvés par **trois méthodes complémentaires** — revue de conception avant le code, mutations volontaires, et recette réelle dans un navigateur. Aucune ne suffit seule.

## 6. Actions en attente (suivi)

| # | Action | Responsable | Depuis | À faire avant | État |
|---|---|---|---|---|---|
| 1 | Valider S3.4 puis S3.5 | Ingénieur logiciel | 10-20 / 10-21 | fusion dans `main` | ⏳ |
| 2 | **Accès Microsoft 365** (locataire, application, boîte d'expédition, SPF/DKIM/DMARC) | Administrateur M365 | S3.2 | toute utilisation réelle | ⏳ **bloquant** |
| 3 | **Deux futurs SuperAdmin nominatifs** | Direction produit | S3.2 | mise à disposition des collègues | ⏳ **bloquant** |
| 4 | Trancher D16 (MFA récent pour changer un responsable) | Direction produit | S3.3 | S3.6 | ⏳ |
| 5 | Confirmer deux interprétations (MFA pour tous ; apprenant distinct) | Direction produit | S2 | S5.2 | ⏳ |
| 6 | Détails de l'agrément (5 questions) | Direction commerciale | S2 | S4.4 | ⏳ |
| 7 | Validation juridique : audit 10 ans, données personnelles | Juridique | S2 | mise en production | ⏳ |
| 8 | Revue de `SECURITY.md` (valeurs de départ) | RSSI | S2 | mise en production | ⏳ |
| 9 | Suppression de l'ancienne copie OneDrive | Ingénieur logiciel | S2 | à votre convenance | ⏳ |
| 10 | Exécuter Docker et la CI pour de vrai | Ingénieur + Claude | S1 | S7.2 | ⏳ |
