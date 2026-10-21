# Cadrage de la session S3.6 — Documents

**Date** : 2026-10-21 · **Statut** : **décidé le 2026-10-21** (recommandations retenues) · **Dépend de** : H2 (ordre DEC-005).

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise dans ce document** : les recommandations sont des avis, la décision est celle de la direction produit.

## 1. Objet et périmètre
**S3.6 — Documents** livre le téléversement, la gestion des versions, l'empreinte SHA-256, le téléchargement contrôlé et la traçabilité complète des fichiers (prérequis des pièces jointes : agrément S4.4, incidents S6.3, offres, contrats).

**Hors périmètre** : antivirus (S7), prévisualisation de documents, signature électronique, recherche plein texte, adaptateur S3 de production (S7.1, selon la décision CAD-S36-1).

## 2. État de départ (vérifié)
| Élément | État |
|---|---|
| Base de données | `docs.documents` et `docs.document_versions` existent (statut, version courante, clé de stockage, MIME, taille, SHA-256, verrou optimiste, suppression logique) |
| Audit | Lectures et écritures de documents prévues dans `ARCHITECTURE.md` (création, consultation, modification, téléchargement, export, suppression) |
| API et stockage | Aucun module `documents` ; aucun service de stockage |
| Sécurité | `SECURITY.md` §6 : taille, liste blanche, signature, renommage, hors racine web, SHA-256 ; antivirus en S7 |

## 3. Règles de conception (non soumises à décision)
- Une version est **immuable** ; on ajoute une version, on ne modifie pas le contenu.
- **Suppression = archivage logique** ; aucune suppression définitive sans votre accord explicite.
- Téléchargement **via l'API uniquement** (aucune URL directe), en pièce jointe, `nosniff`.
- Chaque consultation, téléchargement, création de version, archivage est **audité** (qui, quand, quoi, IP).
- Nom de fichier affiché ≠ clé de stockage (aléatoire).

## 4. Décisions à prendre avant de coder
| N° | Question | Options | Ma recommandation |
|---|---|---|---|
| CAD-S36-1 | Stockage | A S3 maintenant · B port + disque local, S3 en S7.1 · C `bytea` | **B** |
| CAD-S36-2 | Contrôles et antivirus | A base + antivirus en S7 (bloquant production) · B antivirus maintenant · C minimal | **A** |
| CAD-S36-3 | Droits | A permissions + portée de l'objet propriétaire · B documents autonomes · C attendre S4 | **A** |

---

### CAD-S36-1 — Stockage des fichiers

**Contexte.** La base contient déjà les tables de métadonnées (`docs.documents`, `docs.document_versions`, clé de stockage aléatoire, SHA-256). `ARCHITECTURE.md` prévoit un stockage objet compatible S3 (MinIO en développement), hors base. Aucun service de stockage n'existe encore, et Docker n'est exécuté « pour de vrai » qu'en S7.

**Déjà décidé, ne bouge pas.** Les fichiers ne sont pas stockés dans la base ; clé de stockage aléatoire (jamais le nom fourni) ; empreinte SHA-256 ; stockage hors racine web ; téléchargement uniquement via l'API après contrôle des droits.

**Options.**

**A. Stockage objet compatible S3 dès S3.6** — Adaptateur S3 (MinIO en développement et en test).

| | |
|---|---|
| Avantages | Conforme à l'architecture ; passage à l'échelle ; sauvegarde et chiffrement par le service. |
| Inconvénients | Service à installer pour les tests et le développement (binaire ou conteneur) ; environnement de test plus lourd ; configuration d'accès à sécuriser. |
| Impact UX | Aucune différence. |
| Impact métier | Aucun. |
| Impact technique | Client S3, service de test, secrets d'accès. |
| Impact maintenance | Un service de plus à exploiter. |
| Coût et délai | ≈ 1,3 session |
| Réversibilité | Bonne (port de stockage). |

**B. Port de stockage + adaptateur disque local maintenant, adaptateur S3 en S7.1** — Interface `ObjectStorage` ; premier adaptateur : dossier hors racine web (volume dédié, droits restreints) ; adaptateur S3 ajouté au durcissement.

| | |
|---|---|
| Avantages | Tests rapides sans service externe ; aucune perte de conception (même port) ; livrable plus tôt. |
| Inconvénients | Le disque local ne convient pas à une exploitation sur plusieurs serveurs ; l'adaptateur S3 reste à écrire et à recetter. |
| Impact UX | Aucune différence. |
| Impact métier | Aucun. |
| Impact technique | Port + adaptateur ; test de contrat commun aux deux adaptateurs. |
| Impact maintenance | Deux adaptateurs à terme, un test de contrat. |
| Coût et délai | ≈ 0,9 session |
| Réversibilité | Excellente. |

**C. Fichiers dans PostgreSQL (`bytea`)** — Contenu stocké en base.

| | |
|---|---|
| Avantages | Aucun service ni dossier ; transactions et sauvegardes uniques. |
| Inconvénients | Contredit l'architecture (documents hors base, ≈ 2 Go/an) ; base qui grossit, sauvegardes lourdes ; mauvaise piste pour le flux. |
| Impact UX | Aucune différence. |
| Impact métier | Aucun. |
| Impact technique | Simple au départ. |
| Impact maintenance | Migration coûteuse plus tard. |
| Coût et délai | ≈ 0,6 session |
| Réversibilité | Faible. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 4 | 3 |
| Risque (favorable = faible) (5) | 4 | 4 | 3 |
| Cohérence architecture / décisions (4) | 5 | 4 | 1 |
| Réversibilité (4) | 4 | 5 | 2 |
| Coût et délai (favorable = faible) (3) | 2 | 4 | 4 |
| **Total sur 5** | **3,90** | **4,19** | **2,57** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Fichier servi hors contrôle de droits | Faible | Élevé | Aucune URL directe : flux via l'API, droits contrôlés à chaque lecture, audit de chaque consultation |
| Perte de fichiers | Faible | Élevé | Sauvegarde du volume ; S3 versionné en production ; vérification périodique des SHA-256 |

**Dette induite.** B : adaptateur S3 à livrer en S7.1 (à inscrire en dette). A : service à exploiter. C : migration future.

**Recommandation.** Option **B** : elle respecte le port prévu par l'architecture, rend S3.6 testable sans service externe et reporte l'adaptateur S3 au durcissement. Ferait changer d'avis : un besoin de production multi-serveurs avant S7 (alors A).

**Décision (direction produit).** ✅ **Option B — port de stockage + adaptateur disque local maintenant, adaptateur S3 en S7.1 (dette à inscrire)** — décidé le 2026-10-21 par la direction produit (recommandation suivie).

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-S36-2 — Contrôles à l'envoi et antivirus

**Contexte.** `SECURITY.md` §6 prévoit taille maximale, liste blanche d'extensions **et** de types détectés par signature, renommage serveur, SHA-256, et analyse antivirus « H, S7 ». Les fichiers téléversés par des utilisateurs sont un vecteur d'attaque classique.

**Déjà décidé, ne bouge pas.** Aucun fichier n'est jamais exécuté ni servi inline ; téléchargement en pièce jointe avec `X-Content-Type-Options: nosniff` ; suppression = archivage logique (jamais de suppression définitive sans votre accord).

**Options.**

**A. Contrôles de base maintenant, antivirus en S7 avec quarantaine d'ici là** — Taille max, liste blanche, signature (octets magiques), SHA-256 ; un fichier reste « à vérifier » tant que l'antivirus n'a pas tourné (S7), sans blocage métier d'ici là.

| | |
|---|---|
| Avantages | Conforme au plan ; protège déjà des cas courants (faux types, doubles extensions) ; antivirus ajouté sans changer le modèle. |
| Inconvénients | Pas d'analyse de virus avant S7 : risque résiduel (fichier Office piégé). |
| Impact UX | Aucune. |
| Impact métier | Risque résiduel accepté jusqu'à S7. |
| Impact technique | Statut de vérification sur la version ; téléchargement conditionné à la politique choisie. |
| Impact maintenance | Faible. |
| Coût et délai | ≈ inclus |
| Réversibilité | Excellente. |

**B. Antivirus dès S3.6 (service d'analyse)** — Service d'analyse (par exemple ClamAV) appelé à chaque envoi.

| | |
|---|---|
| Avantages | Protection maximale dès le premier jour. |
| Inconvénients | Service supplémentaire à exploiter pour S3.6 ; environnement de test plus lourd ; mises à jour des signatures. |
| Impact UX | Délai à l'envoi. |
| Impact métier | Aucun. |
| Impact technique | Port « scanner », adaptateur, service. |
| Impact maintenance | Service et signatures à entretenir. |
| Coût et délai | + 0,8 session |
| Réversibilité | Bonne. |

**C. Contrôles minimaux (taille et extension seulement)** — Pas de contrôle de signature.

| | |
|---|---|
| Avantages | Très rapide. |
| Inconvénients | Contredit `SECURITY.md` ; fichiers falsifiés acceptés. |
| Impact UX | Aucune. |
| Impact métier | Aucun. |
| Impact technique | Minimal. |
| Impact maintenance | Dette de sécurité. |
| Coût et délai | - 0,2 session |
| Réversibilité | Facile à renforcer. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 4 | 2 |
| Risque (favorable = faible) (5) | 3 | 5 | 1 |
| Cohérence architecture / décisions (4) | 5 | 4 | 1 |
| Réversibilité (4) | 5 | 4 | 4 |
| Coût et délai (favorable = faible) (3) | 4 | 2 | 5 |
| **Total sur 5** | **4,14** | **3,95** | **2,38** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Fichier piégé téléversé avant S7 | Faible à moyenne | Élevé | Liste blanche courte, aucun rendu inline, téléchargement forcé, statut « à vérifier », antivirus en S7 avant mise en production |
| Déni de service par gros fichiers | Moyenne | Moyen | Taille maximale, limitation du débit, flux sans chargement complet en mémoire |

**Dette induite.** A : antivirus à livrer en S7.2 (bloquant pour la mise en production).

**Recommandation.** Option **A**, avec l'antivirus inscrit comme condition **bloquante** de la mise en production (S7.2). Ferait changer d'avis : un envoi de fichiers par des tiers non authentifiés (alors B, dès maintenant). **À préciser** : formats autorisés (proposition : PDF, JPG, PNG, DOCX, XLSX) et taille maximale (proposition : 10 Mo).

**Décision (direction produit).** ✅ **Option A — contrôles de base maintenant, antivirus en S7 (condition bloquante de la mise en production)** — décidé le 2026-10-21 par la direction produit (recommandation suivie).

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-S36-3 — Droits d'accès aux documents

**Contexte.** Un document appartient à un objet d'un autre contexte (type + identifiant, sans clé étrangère). Aujourd'hui, seules les **entreprises** existent comme objet propriétaire ; offres, opportunités, agréments, sessions et incidents arriveront en S4 à S6.

**Déjà décidé, ne bouge pas.** Droits fondés sur les permissions et les portées (Propre / Équipe / Tous) ; objet hors portée = introuvable (404) ; chaque lecture, téléchargement et modification est auditée.

**Options.**

**A. Permissions `docs.*` + portée héritée de l'objet propriétaire via un résolveur par module** — Un document est accessible si l'utilisateur a la permission documentaire **et** accède à l'objet propriétaire ; chaque module fournit son résolveur (en S3.6 : entreprises).

| | |
|---|---|
| Avantages | Pas de contournement : un document n'est jamais plus accessible que son objet ; extensible à chaque module. |
| Inconvénients | Couplage via un port à implémenter dans chaque module ; un résolveur oublié = refus par défaut (sûr, mais bloquant). |
| Impact UX | Cohérent avec le reste de l'application. |
| Impact métier | Les pièces suivent les droits de leur dossier. |
| Impact technique | Port `OwnerAccess`, tests de matrice de droits. |
| Impact maintenance | Un résolveur à écrire à chaque nouveau module. |
| Coût et délai | ≈ inclus |
| Réversibilité | Bonne. |

**B. Documents autonomes (créateur + rôles)** — Droits propres au document : le créateur, plus certains rôles en lecture.

| | |
|---|---|
| Avantages | Simple ; aucun couplage. |
| Inconvénients | Un document peut devenir plus accessible que son dossier (ou l'inverse) ; incohérences de droits ; difficile à corriger après coup. |
| Impact UX | Surprises possibles. |
| Impact métier | Risque de fuite entre équipes. |
| Impact technique | Modèle de droits parallèle. |
| Impact maintenance | Double logique de droits. |
| Coût et délai | - 0,2 session |
| Réversibilité | Faible. |

**C. Attendre S4 pour livrer Documents** — S3.6 décalée après S4.1.

| | |
|---|---|
| Avantages | On conçoit avec des objets réels. |
| Inconvénients | S4.4 (agrément) et les incidents ont besoin des pièces jointes ; retarde S3.6 sans gain majeur. |
| Impact UX | Aucune. |
| Impact métier | Retard des pièces jointes. |
| Impact technique | Aucune. |
| Impact maintenance | Aucune. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 2 | 2 |
| Risque (favorable = faible) (5) | 5 | 2 | 4 |
| Cohérence architecture / décisions (4) | 5 | 2 | 3 |
| Réversibilité (4) | 4 | 2 | 5 |
| Coût et délai (favorable = faible) (3) | 3 | 4 | 5 |
| **Total sur 5** | **4,29** | **2,29** | **3,67** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Document visible hors du périmètre de son dossier | Faible | Élevé | Résolveur obligatoire, refus par défaut, matrice de droits HTTP rôle × route comme pour le RBAC |
| Énumération d'identifiants de documents | Faible | Moyen | Identifiants non prédictibles, 404 hors portée |

**Dette induite.** A : un résolveur par module à entretenir.

**Recommandation.** Option **A** : elle garantit qu'un document n'est jamais plus visible que son dossier. Ferait changer d'avis : un besoin de partage de documents transversaux (modèles, procédures) sans objet propriétaire — à traiter alors comme un propriétaire « organisation ».

**Décision (direction produit).** ✅ **Option A — permissions docs.* + portée héritée de l'objet propriétaire** — décidé le 2026-10-21 par la direction produit (recommandation suivie).

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

## 5. Questions ouvertes pour la direction produit
1. **Formats autorisés** et **taille maximale** (proposition : PDF, JPG, PNG, DOCX, XLSX ; 10 Mo).
2. **Durée de conservation** des documents archivés (à relier à l'avis juridique de l'Étape 0).
3. **Catégories de documents** (décharge, contrat, agrément signé, justificatif…) : liste initiale à fournir.

## 6. Plan de réalisation proposé
1. Domaine : document, version, politiques (formats, taille), port `ObjectStorage` et port `OwnerAccess`.
2. Infrastructure : adaptateur de stockage, dépôt Prisma (tables déjà créées, migration éventuelle de compléments), calcul SHA-256 en flux.
3. API : envoi, nouvelle version, liste par propriétaire, métadonnées, téléchargement, archivage ; toutes protégées (`@Protected`), déclarées dans la matrice de droits.
4. Interface minimale de pièces jointes sur la fiche entreprise (composant réutilisable pour S4).
5. Preuves : tests unitaires, intégration (base jetable), matrice de droits, test de contrat du stockage, mutants sur les contrôles de type, recette `SPRINT-S3-6-RECETTE.md`, mise à jour de la documentation.

## 7. Critères de réussite
Fichier falsifié (extension ≠ signature) refusé ; SHA-256 vérifié au téléchargement ; hors portée = 404 ; chaque accès tracé dans l'audit ; aucune route non protégée (test `route-protection`) ; aucun contenu servi inline.
