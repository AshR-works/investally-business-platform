# Cadrage de la session H2 — Authentification complète et sessions

**Date** : 2026-10-21 · **Statut** : **décidé le 2026-10-21** (recommandations retenues) · **Dépend de** : H1.

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise dans ce document** : les recommandations sont des avis, la décision est celle de la direction produit.

## 1. Objet et périmètre
**H2 — Authentification complète et sessions** applique le nouveau style à tous les écrans d'accès et ajoute l'**historique des connexions** (seule nouvelle route de l'API). Elle suit H1 et précède S3.6 (DEC-005).

**Hors périmètre** : changement des règles d'authentification (argon2id, MFA obligatoire, verrouillage progressif, durées de vie), nouveau mode de connexion, portail apprenant.

## 2. État de départ (vérifié)
| Élément | État |
|---|---|
| Écrans | Connexion, MFA (saisie, enrôlement avec QR, codes de secours), invitation, mot de passe oublié, réinitialisation, Mon compte avec ses sessions |
| API | `auth/sessions` (mes sessions, révocation), reset et invitation, step-up ; **aucune route d'historique** |
| Sources d'historique | `audit.audit_logs` (LOGIN, LOGIN_FAILED, IP, appareil) ; `iam.login_attempts` (e-mail, IP, résultat) |
| Accessibilité | Audit à 0 violation ; écoute humaine non faite (D31) |

## 3. Les 18 écrans
Liste de référence : `docs/design/04-ANALYSE-D-IMPACT.md` §4.1 (A01 à A18). Enjeux UX : anti-énumération, QR et codes affichés une seule fois, reprise d'enrôlement, états d'erreur explicites (code périmé, compte verrouillé, limite de débit), lisibilité mobile.

## 4. Décisions à prendre avant de coder
| N° | Question | Options | Ma recommandation |
|---|---|---|---|
| CAD-H2-1 | Source de l'historique | A journal d'audit · B `login_attempts` · C nouvelle table · D pas d'historique | **A** |
| CAD-H2-2 | Qui voit l'historique | A le sien · B + SuperAdmin avec step-up · C + rôle Sécurité | **A** |
| CAD-H2-3 | Découpage | A un lot · B deux lots (H2a / H2b) | **B** |

---

### CAD-H2-1 — Source de l'historique des connexions

**Contexte.** EXD-06 exige un écran « historique des connexions » (date, adresse IP, appareil, résultat). Il n'existe **aucune route** qui le fournit. Trois sources de données existent : le journal d'audit (`audit.audit_logs`, actions `LOGIN` et `LOGIN_FAILED`, avec IP et appareil, ajout seul, 10 ans), la table `iam.login_attempts` (anti-force-brute : e-mail, IP, résultat, sans appareil) et rien d'autre.

**Déjà décidé, ne bouge pas.** Le journal d'audit est la source de vérité des actions sensibles et reste en ajout seul. Les messages d'erreur d'authentification restent identiques (anti-énumération).

**Options.**

**A. Lire le journal d'audit (connexions de l'utilisateur)** — Nouvelle route « mon historique » qui lit `audit_logs` filtré sur l'utilisateur et les actions de connexion.

| | |
|---|---|
| Avantages | Aucune nouvelle table ; contient déjà IP et appareil ; conservation longue ; index `(user_id, created_at)` existant. |
| Inconvénients | Mélange lecture applicative et table d'audit partitionnée ; il faut borner la période et la taille ; dépend du format des lignes d'audit. |
| Impact UX | Historique complet et fiable, avec appareil. |
| Impact métier | Cohérent avec la traçabilité exigée. |
| Impact technique | Un cas d'usage de lecture, pagination, bornes de dates ; à vérifier : les échecs pour un compte connu portent bien l'identifiant utilisateur. |
| Impact maintenance | Lié au schéma d'audit. |
| Coût et délai | ≈ 0,5 session |
| Réversibilité | Bonne (route remplaçable). |

**B. Lire `iam.login_attempts`** — La route lit la table de contrôle anti-force-brute.

| | |
|---|---|
| Avantages | Table déjà dédiée à l'authentification ; requêtes simples. |
| Inconvénients | Pas d'appareil ; vocation technique (peut être purgée) ; couplée à la logique de verrouillage. |
| Impact UX | Historique incomplet (pas d'appareil). |
| Impact métier | Faible. |
| Impact technique | Lecture simple. |
| Impact maintenance | Risque de casser la logique de verrouillage si la table évolue. |
| Coût et délai | ≈ 0,3 session |
| Réversibilité | Bonne. |

**C. Nouvelle table dédiée `login_events`** — Table d'événements d'authentification dédiée à l'affichage (alimentée à chaque connexion).

| | |
|---|---|
| Avantages | Modèle sur mesure ; requêtes rapides ; durée de conservation propre. |
| Inconvénients | Duplique l'audit et les tentatives ; migration ; risque de divergence entre trois sources. |
| Impact UX | Excellente. |
| Impact métier | Aucun gain réel. |
| Impact technique | Migration, écriture à chaque connexion (hors transaction critique ?), tests de cohérence. |
| Impact maintenance | Trois sources à garder alignées. |
| Coût et délai | ≈ 1 session |
| Réversibilité | Moyenne (migration). |

**D. Pas d'historique en H2 (sessions actives seulement)** — On affiche les sessions actives et leur révocation ; l'historique vient plus tard.

| | |
|---|---|
| Avantages | Aucun développement d'API ; H2 plus court. |
| Inconvénients | EXD-06 non satisfaite ; l'utilisateur ne peut pas repérer une connexion suspecte passée. |
| Impact UX | Moins de transparence. |
| Impact métier | Aucun. |
| Impact technique | Aucune. |
| Impact maintenance | Aucune. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C | D |
|---|---|---|---|---|
| Valeur métier (5) | 4 | 2 | 4 | 2 |
| Risque (favorable = faible) (5) | 4 | 3 | 3 | 4 |
| Cohérence architecture / décisions (4) | 5 | 3 | 2 | 2 |
| Réversibilité (4) | 4 | 4 | 2 | 5 |
| Coût et délai (favorable = faible) (3) | 4 | 5 | 2 | 5 |
| **Total sur 5** | **4,19** | **3,24** | **2,71** | **3,48** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Fuite d'informations d'un autre utilisateur (IDOR) | Faible | Élevé | Route « mon historique » filtrée par l'identité du jeton, jamais par un identifiant fourni ; test dédié |
| Requêtes lentes sur l'audit partitionné | Faible | Moyen | Fenêtre de dates bornée (par exemple 90 jours), pagination, plafond de lignes |
| Données personnelles (IP) affichées | Moyenne | Moyen | Visible uniquement par l'intéressé (et, si décidé, par un administrateur avec step-up) ; mention dans le registre de traitement |

**Dette induite.** A : dépendance au format des lignes d'audit (à documenter). C : une source de plus à aligner.

**Recommandation.** Option **A** : pas de duplication, appareil et IP disponibles, conservation déjà décidée. Condition : vérifier en début de session que les connexions échouées d'un compte connu portent l'identifiant utilisateur ; sinon, afficher uniquement les succès et les échecs rattachables. Ferait changer d'avis : une exigence de durée de conservation ou de volume incompatible avec l'audit.

**Décision (direction produit).** ✅ **Option A — lecture du journal d'audit (à vérifier : échecs rattachables à l'utilisateur)** — décidé le 2026-10-21 par la direction produit (recommandation suivie).

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-H2-2 — Visibilité de l'historique des connexions

**Contexte.** L'historique contient des adresses IP et des appareils, donc des données personnelles. La question : qui peut le voir ?

**Déjà décidé, ne bouge pas.** Chacun voit ses propres sessions (route existante `auth/sessions`) ; un SuperAdmin en portée « Tous » peut révoquer des sessions avec step-up.

**Options.**

**A. Chacun voit uniquement le sien** — Aucune vue administrateur de l'historique.

| | |
|---|---|
| Avantages | Minimisation maximale ; aucune question de finalité ; simple. |
| Inconvénients | L'administrateur ne peut pas enquêter sur un compte (il garde le journal d'audit). |
| Impact UX | Transparence pour l'utilisateur. |
| Impact métier | Enquête de sécurité via l'audit uniquement. |
| Impact technique | Une route. |
| Impact maintenance | Faible. |
| Coût et délai | inclus |
| Réversibilité | Excellente (on peut élargir). |

**B. Le sien + SuperAdmin avec step-up (Utilisateurs > détail)** — Un SuperAdmin peut voir l'historique d'un compte après une nouvelle preuve MFA ; chaque consultation est auditée.

| | |
|---|---|
| Avantages | Aide à l'enquête sur un compte compromis ; usage tracé. |
| Inconvénients | Donnée personnelle accessible à une autre personne ; finalité à écrire ; deuxième route et tests de droits. |
| Impact UX | Écran de plus. |
| Impact métier | Utile à la sécurité. |
| Impact technique | Permission dédiée, step-up, audit de lecture. |
| Impact maintenance | Un cas de plus dans la matrice des droits. |
| Coût et délai | + 0,3 session |
| Réversibilité | Bonne. |

**C. Le sien + un rôle Sécurité en lecture** — Un rôle (Sécurité/Support) voit les historiques, sans pouvoir d'action.

| | |
|---|---|
| Avantages | Séparation des pouvoirs. |
| Inconvénients | Ce rôle n'existe pas dans le catalogue (10 rôles actuels) ; exige une décision de rôles. |
| Impact UX | Écran de plus. |
| Impact métier | Organisation à définir. |
| Impact technique | Rôle, permission, tests. |
| Impact maintenance | Catalogue de rôles à étendre. |
| Coût et délai | + 0,5 session |
| Réversibilité | Moyenne. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (favorable = faible) (5) | 5 | 3 | 3 |
| Cohérence architecture / décisions (4) | 5 | 4 | 2 |
| Réversibilité (4) | 5 | 4 | 3 |
| Coût et délai (favorable = faible) (3) | 5 | 3 | 2 |
| **Total sur 5** | **4,52** | **3,62** | **2,90** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Accès non justifié à des données personnelles | Faible | Moyen | Finalité écrite, step-up, audit de chaque consultation, revue périodique |

**Dette induite.** B : finalité et registre de traitement à tenir.

**Recommandation.** Option **A** pour H2 (minimisation) ; l'option B pourra être ajoutée plus tard sans migration. Ferait changer d'avis : une obligation d'enquête de sécurité formalisée.

**Décision (direction produit).** ✅ **Option A — chacun voit uniquement son historique** — décidé le 2026-10-21 par la direction produit (recommandation suivie).

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-H2-3 — Découpage des 18 écrans en lots

**Contexte.** Les 18 écrans d'authentification et de sessions (analyse d'impact §4.1) couvrent des parcours qui existent déjà (connexion, MFA, invitation, réinitialisation) et des états nouveaux (verrouillage, limite de débit, reprise d'enrôlement, historique).

**Déjà décidé, ne bouge pas.** Les messages d'erreur d'authentification restent identiques pour compte connu ou inconnu ; QR et codes de secours affichés une seule fois ; aucune règle de sécurité n'est modifiée.

**Options.**

**A. Un seul lot** — Les 18 écrans en une session (plan actuel).

| | |
|---|---|
| Avantages | Parcours d'accès cohérent d'un coup ; une recette. |
| Inconvénients | Session longue ; recette de sécurité très large. |
| Impact UX | Cohérence immédiate. |
| Impact métier | Aucun. |
| Impact technique | Touche tous les écrans de sécurité à la fois. |
| Impact maintenance | Un chantier. |
| Coût et délai | ≈ 1,5 session |
| Réversibilité | Bonne. |

**B. Deux lots : H2a parcours d'accès, H2b compte et sessions (+ historique)** — H2a : connexion, MFA, invitation, réinitialisation. H2b : Mon compte, sessions, historique, codes de secours.

| | |
|---|---|
| Avantages | Recettes plus courtes ; le lot sans API (H2a) est livrable seul ; risque réparti. |
| Inconvénients | Deux validations ; cohabitation temporaire entre les deux lots. |
| Impact UX | Livraison progressive. |
| Impact métier | Aucun. |
| Impact technique | H2b porte la seule nouvelle route. |
| Impact maintenance | Deux recettes. |
| Coût et délai | ≈ 1,6 session au total |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B |
|---|---|---|
| Valeur métier (5) | 4 | 4 |
| Risque (favorable = faible) (5) | 3 | 4 |
| Cohérence architecture / décisions (4) | 5 | 5 |
| Réversibilité (4) | 4 | 5 |
| Coût et délai (favorable = faible) (3) | 3 | 3 |
| **Total sur 5** | **3,81** | **4,24** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Régression d'un parcours de sécurité | Moyenne | Élevé | Recette de sécurité rejouée à chaque lot (tests existants + navigateur réel), axe-core |

**Dette induite.** Faible dans les deux cas.

**Recommandation.** Option **B** (deux lots) : elle réduit le risque sur des écrans de sécurité et permet de valider d'abord ce qui ne touche pas à l'API. Ferait changer d'avis : un besoin de livrer tout l'accès en une seule étape.

**Décision (direction produit).** ✅ **Option B — deux lots (H2a parcours d'accès, H2b compte, sessions et historique)** — décidé le 2026-10-21 par la direction produit (recommandation suivie).

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

## 5. Plan de réalisation proposé
1. **H2a** : écrans d'accès au nouveau style (connexion, MFA, invitation, réinitialisation) ; états d'erreur, verrouillage, limite de débit ; recette de sécurité rejouée.
2. **H2b** : route « mon historique » (identité du jeton, fenêtre de dates bornée, pagination, test IDOR et matrice de droits), écrans Mon compte, sessions, historique, codes de secours.
3. **Preuves** : tests API et web, route-protection (la nouvelle route doit être déclarée), axe-core, parcours réels, recette `SPRINT-H2-RECETTE.md`, mise à jour du document de design.

## 6. Prérequis et réserves
- Écoute avec un lecteur d'écran réel avant H2 (D31) : recommandée, non bloquante (à vous de trancher).
- Microsoft 365 ajourné : les e-mails de réinitialisation continuent d'utiliser l'adaptateur « journal » (aucun envoi réel).
- Avis juridique sur les données personnelles (IP, appareils) : à inclure dans l'Étape 0.

## 7. Critères de réussite
Parcours de sécurité inchangés et rejoués ; messages identiques compte connu/inconnu ; historique visible uniquement par l'intéressé ; 0 violation axe ; aucune régression des 535 commentaires et des tests existants.
