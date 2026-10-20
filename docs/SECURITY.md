# Sécurité — CRM Investally

> Statut : conception Sprint 2 (implémentation : S3 pour l'authentification, S7 pour l'exploitation). Les valeurs marquées (H) sont des hypothèses à confirmer avec le RSSI.
> Périmètre : le produit CRM. L'ERP aura son propre document ; l'authentification est conçue pour être réutilisable (SSO) — ADR-0005.

## 1. Principes
1. **Moindre privilège** : aucun droit par défaut, tout accès passe par une permission explicite (voir `RBAC.md`).
2. **Défense en profondeur** : validation d'entrée → autorisation → règle de domaine → contrainte SQL.
3. **Tout est traçable** : action sensible = ligne d'audit (ADR-0004) dans la même transaction.
4. **Échec sûr** : en cas de doute (token invalide, session inconnue, erreur d'autorisation), on refuse.
5. **Pas de secret dans le code, les logs, les URL ni les journaux d'audit.**

## 2. Authentification

### 2.1 Mots de passe
| Règle | Valeur | Justification |
|---|---|---|
| Algorithme | **argon2id** (m ≥ 19 MiB, t ≥ 2, p = 1 — minimum OWASP) | Résiste au GPU ; paramètres relevés tant que la latence de connexion reste < 500 ms |
| Longueur | ≥ 12 caractères, plafond 128 | NIST SP 800-63B : la longueur prime sur la complexité |
| Composition | Pas de règle « 1 majuscule 1 symbole » | Produit des mots de passe prévisibles |
| Mots de passe courants/compromis | Refus si dans une liste locale (top 10 000) | Mitigation du credential stuffing |
| Dérivés de l'identité | Refus si contient l'e-mail ou le nom | |
| Réutilisation | Refus des 5 derniers (table `password_history`) | |
| Expiration périodique | **Non** (changement sur suspicion de compromission) | NIST 800-63B : la rotation forcée dégrade la qualité |
| Comparaison | Temps constant ; message d'erreur unique « Identifiants invalides » | Pas d'énumération de comptes |

### 2.2 Jetons
- **Access token** : JWT **ES256** (asymétrique), durée **15 min**, `kid` pour la rotation des clés. Asymétrique pour que l'ERP puisse **valider** les jetons sans connaître le secret de signature (prépare le SSO). Claims : `sub` (UUID utilisateur), `sid` (UUID session), `amr` (méthodes d'authentification, ex. `pwd`, `otp`), `iat`, `exp`, `iss`, `aud`. **Aucune permission dans le jeton** : elles sont résolues côté serveur (cache court) pour que la révocation soit immédiate.
- **Refresh token** : valeur opaque aléatoire de 256 bits, **stockée hachée** (SHA-256) ; **rotation à chaque usage** avec détection de réutilisation : un jeton déjà utilisé présenté de nouveau révoque toute la famille et la session (vol probable) et déclenche une alerte.
  - Inactivité maximale **8 h**, durée absolue **7 jours** ; **12 h absolues** pour les rôles privilégiés (SuperAdmin, Direction, Finance) (H).
- **Stockage côté navigateur** : refresh token en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` ; access token **en mémoire uniquement** (jamais `localStorage`). Même origine grâce au proxy Next.js : pas de CORS ouvert.
- **Clés de signature** : hors dépôt (variable d'environnement / coffre), rotation planifiée (tous les 90 jours) ; l'ancienne clé reste valide pour la vérification le temps de la durée de vie d'un access token.

### 2.3 MFA et OTP
| Élément | Décision |
|---|---|
| Facteur principal | **TOTP** RFC 6238 (application d'authentification), 6 chiffres, fenêtre ±1 pas |
| Obligatoire pour | SuperAdmin, Direction, Finance, RH, Fiscalité (accès à des données sensibles) ; **recommandé** pour les autres, obligatoire dès S7 (H) |
| Secret TOTP | Chiffré au repos (AES-256-GCM, clé hors base) ; jamais loggé |
| Codes de secours | 10 codes à usage unique, hachés, régénérables |
| OTP e-mail | Réservé à la **récupération** et à la validation d'action sensible ; 6 chiffres, validité 10 min, 3 essais, haché |
| SMS | **Non retenu** comme facteur d'authentification (SIM swap) ; éventuel canal de notification seulement |
| Step-up | Action à risque (export massif, changement de rôle, suppression) ⇒ ré-authentification MFA récente (< 10 min) |

### 2.4 Protection contre la force brute
- **Par compte** : 5 échecs consécutifs ⇒ verrouillage progressif (1, 5, 15, 60 min), **jamais définitif** (un verrou permanent permet de bloquer volontairement un compte). Déverrouillage par un administrateur ou par réinitialisation.
- **Par IP et par couple IP+e-mail** : limitation de débit — connexion **5 tentatives/min**, API générale **100 req/min/IP** (valeurs de départ, H), réponse 429 avec `Retry-After`.
- Mêmes temps de réponse que le compte existe ou non (hachage factice si compte inconnu).
- Toutes les tentatives échouées et réussies sont journalisées (table `login_attempts` + audit `LOGIN`).

## 3. Sessions
Une ligne `UserSession` par connexion : IP, appareil, navigateur, système, dates de connexion/déconnexion/dernière activité/expiration, **niveau de risque**, état MFA, motif de révocation.

**Niveau de risque** (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) calculé à la connexion et à chaque renouvellement :
| Signal | Poids |
|---|---|
| Nouvel appareil / navigateur jamais vu pour ce compte | +1 |
| Nouvelle plage IP jamais vue | +1 |
| Échecs de connexion récents avant ce succès | +1 à +2 |
| Connexion hors horaires habituels (H) | +1 |
| Rôle privilégié | +1 |
| Réutilisation de refresh token détectée | CRITICAL immédiat |
Seuils : 0–1 `LOW` · 2 `MEDIUM` · 3 `HIGH` (step-up MFA exigé) · ≥ 4 ou réutilisation `CRITICAL` (session révoquée, alerte sécurité).

Contrôles : liste des sessions actives consultable et révocable par l'utilisateur ; **révocation globale** par un administrateur (« kill switch » d'incident) ; toute révocation est auditée.

## 4. Autorisation
Voir `RBAC.md` : contrôle **à chaque requête** côté serveur (jamais seulement dans l'interface), vérification du **rôle**, de la **permission**, puis de la **portée** (propre / équipe / tout) sur l'objet concerné (prévention de l'IDOR). Refus par défaut. Les contrôles se font dans la couche Application (use case), les Guards de Presentation ne font que l'authentification et l'extraction de l'identité.

## 5. Audit et traçabilité (synthèse ADR-0004)
- `AuditLog` : id, userId, sessionId, module, entityType, entityId, action, oldValue, newValue, ipAddress, device, createdAt. Append-only (déclencheur SQL ; rôle applicatif sans `UPDATE/DELETE` en production, voir §10), **partitionné par mois**.
- **Champs masqués** dans `oldValue/newValue` : `passwordHash`, secrets MFA, jetons, codes OTP, numéros de pièce d'identité complets. Liste centralisée, testée.
- Événements à auditer obligatoirement : connexion/déconnexion/échec, changement de mot de passe ou de MFA, création/modification/suppression d'utilisateur ou de rôle, toute modification de donnée métier, **consultation, téléchargement, export** de document, export de données, révocation de session, accès refusé (403) sur une ressource sensible.
- **Traçabilité documentaire** : pour chaque document, l'historique complet (création, consultation, modification, téléchargement, export, suppression) se lit dans `AuditLog` (`entityType = 'Document'`) ; les versions de fichier sont conservées avec empreinte SHA-256. Source unique de vérité, pas de second journal.
- Lecture du journal réservée (`audit.log.read`) ; aucune permission d'écriture/suppression n'existe dans le catalogue.

## 6. Menaces OWASP Top 10 (2021) → mesures
| # | Risque | Mesures |
|---|---|---|
| A01 | Contrôle d'accès défaillant | RBAC avec portée, refus par défaut, vérification serveur par objet, tests d'autorisation par rôle (S3) |
| A02 | Défaillances cryptographiques | argon2id, TLS 1.2+ partout, HSTS, secrets chiffrés au repos (AES-256-GCM), aucune donnée sensible en clair dans les logs |
| A03 | Injection | Prisma (requêtes paramétrées), `$queryRaw` en *tagged template* uniquement, validation stricte des DTO (`whitelist`, `forbidNonWhitelisted`), aucun SQL concaténé (règle de revue) |
| A04 | Conception non sécurisée | Ce document, revue d'architecture, ADR, tests d'architecture automatiques |
| A05 | Mauvaise configuration | `helmet`, pas de CORS ouvert, écoute locale tant que non authentifié, configuration par environnement validée au démarrage, Swagger **désactivé en production** |
| A06 | Composants vulnérables | `pnpm audit` en CI, lockfile versionné, versions épinglées, suivi des dépendances (dette D6) |
| A07 | Identification et authentification | §2 et §3 |
| A08 | Intégrité des logiciels et des données | CI obligatoire, images Docker reproductibles, `frozen-lockfile`, empreintes de documents |
| A09 | Journalisation et supervision | §5 + métriques et alertes (S7) |
| A10 | SSRF | Aucune URL fournie par l'utilisateur n'est appelée côté serveur ; si besoin futur : liste blanche |

### XSS
React échappe par défaut ; **interdit** : `dangerouslySetInnerHTML` sans assainissement ; CSP stricte sur le frontend (`default-src 'self'`, pas de `unsafe-inline` pour les scripts) ; en-têtes `X-Content-Type-Options: nosniff`. Les documents téléchargés sont servis avec `Content-Disposition: attachment` et un type MIME contrôlé (jamais exécutés dans l'origine de l'application).

### CSRF
Refresh token en cookie `SameSite=Strict` + vérification des en-têtes `Origin`/`Referer` sur les routes d'authentification ; les appels de données utilisent l'en-tête `Authorization` (non envoyé automatiquement par le navigateur), donc non CSRF-able.

### Injection SQL
Aucune requête SQL concaténée. Les migrations SQL brutes sont relues. Test automatisé (recette S1 E2) : tentative d'injection dans les paramètres de recherche.

### Téléversement de fichiers (S3)
Taille maximale, liste blanche d'extensions **et** de types MIME détectés par signature, renommage côté serveur (clé de stockage aléatoire), stockage hors racine web, analyse antivirus (H, S7), empreinte SHA-256.

## 7. Données personnelles
Cartographie à établir (apprenants, contacts, employés dans l'ERP) ; minimisation ; accès restreint par rôle ; droit d'accès/effacement via soft delete puis **anonymisation** programmée (les lignes d'audit conservent l'identifiant technique, pas les données). Durées de conservation à valider avec le juridique (H : audit 10 ans).

## 8. Réponse aux incidents
| Niveau | Exemple | Délai de prise en charge (H) |
|---|---|---|
| SEV1 | Compromission de compte privilégié, fuite de données, session `CRITICAL` en série | immédiat |
| SEV2 | Pic de connexions échouées, export anormal, réutilisation de refresh token | 1 h |
| SEV3 | Vulnérabilité de dépendance sans exploitation connue | 3 jours |
Étapes : **détecter** (alertes §5) → **contenir** (révocation globale des sessions, verrouillage de comptes, rotation des clés de signature, coupure du service si nécessaire) → **éradiquer** (corriger la cause, réinitialiser les identifiants concernés) → **récupérer** (restauration depuis sauvegarde si besoin) → **post-mortem sans blâme** (skill `incident-response`) → mesures correctives suivies dans `TECH-DEBT.md`. Les journaux d'audit servent de preuve : leur intégrité est une priorité (copie périodique hors base, S7).

## 9. Sauvegardes
Quotidiennes chiffrées + archivage continu des journaux de transaction (RPO ≤ 15 min, RTO ≤ 4 h, H) ; conservation 30 jours en ligne + mensuelles 12 mois ; **test de restauration trimestriel documenté** ; clés de sauvegarde séparées des clés applicatives ; copie hors site.

## 10. Exigences d'exploitation différées
- Rôle PostgreSQL applicatif **sans** `UPDATE/DELETE` sur `audit.audit_logs` et sans droits DDL (propriétaire séparé pour les migrations) : script `prisma/ops/` + procédure (S7). D'ici là, le déclencheur SQL est l'unique garde (un propriétaire de table peut le désactiver).
- Création automatique des partitions mensuelles d'audit : fonction fournie en S2, appel planifié en S7.
- Détection d'anomalies et tableaux de bord sécurité (S6/S7).
