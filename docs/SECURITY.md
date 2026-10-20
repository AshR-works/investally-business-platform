# Sécurité — CRM Investally

> Statut : conception Sprint 2 ; **S3.1 a implémenté** §2.1 (mots de passe), §2.2 (jetons), §2.4 (force brute) et §3 (sessions, score de risque) ; **S3.3 a implémenté** §4 (autorisation, voir §4.1) et l'invitation par lien (ferme la dette D13) ; **S3.2 a implémenté** §2.3 (MFA TOTP, codes de secours, step-up, anti-rejeu) et §2.6 (port e-mail, adaptateur Microsoft Graph testé contre un faux serveur uniquement) ; reste : OTP par e-mail (écarté pour l'instant), autorisation (S3.3), exploitation (S7). **Décisions produit du 2026-10-20 intégrées** : MFA obligatoire pour tous, SuperAdmin à accès complet, durées de session confirmées, e-mail via Microsoft 365, audit conservé 10 ans. Les valeurs encore marquées (H) restent des hypothèses à confirmer avec le RSSI.
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
  - Inactivité maximale **8 h**, durée absolue **7 jours** ; **12 h absolues** pour les rôles privilégiés (SuperAdmin, Direction, Finance). *Valeurs confirmées le 2026-10-20 ; configurables par environnement.*
- **Stockage côté navigateur** : refresh token en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` ; access token **en mémoire uniquement** (jamais `localStorage`). Même origine grâce au proxy Next.js : pas de CORS ouvert.
- **Clés de signature** : hors dépôt (variable d'environnement / coffre), rotation planifiée (tous les 90 jours) ; l'ancienne clé reste valide pour la vérification le temps de la durée de vie d'un access token.

### 2.3 MFA et OTP
| Élément | Décision |
|---|---|
| Facteur principal | **TOTP** RFC 6238 (application d'authentification), 6 chiffres, fenêtre ±1 pas |
| Obligatoire pour | **Tous les rôles** (décision produit du 2026-10-20). Première connexion : enrôlement TOTP obligatoire avant tout accès. L'indicateur `mfaRequired` de chaque rôle permet d'assouplir si besoin |
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

### 2.5 Compte SuperAdmin (accès complet)
Décision produit : le SuperAdmin accède à tout le CRM (administration, métier, audit). Un compte qui voit tout est la cible n°1 ; les mesures compensatoires suivantes sont **obligatoires** :
- MFA obligatoire et **step-up** (MFA < 10 min) pour attribuer un rôle, réinitialiser un MFA, exporter massivement ou supprimer.
- **Interdiction de modifier ses propres rôles** (un second SuperAdmin doit le faire) ; au moins **deux** comptes SuperAdmin nominatifs pour la continuité, **aucun compte partagé**.
- Session absolue **12 h**, niveau de risque ≥ `HIGH` ⇒ nouvelle authentification.
- Toutes ses actions sont auditées ; les **actions sensibles du SuperAdmin** (attribution de rôle, export, accès au journal d'audit) déclenchent une notification à la Direction (S7).
- Revue trimestrielle de la liste des SuperAdmin et de leurs actions.
- Le « bris de glace » n'est plus nécessaire (accès permanent), mais l'accès direct à la base reste réservé à l'exploitation et séparé de l'application.

### 2.6 Envoi d'e-mails (Microsoft 365)
Invitations de compte, réinitialisation de mot de passe, codes de récupération. Décision : **Microsoft 365**.
- Interface `EmailSender` (port de l'Application) ; adaptateur `Microsoft365EmailSender` dans l'Infrastructure. En développement et en test : adaptateur qui écrit dans un journal, **jamais d'envoi réel**.
- Mode d'envoi retenu : **API Microsoft Graph** (`sendMail`) avec une **application enregistrée** dans votre Entra ID (identifiants applicatifs, boîte d'envoi dédiée, permission limitée à l'envoi). Raison : Microsoft retire progressivement l'authentification basique de SMTP ; à confirmer avec l'administrateur Microsoft 365 (disponibilité d'une boîte technique, politique d'accès conditionnel).
- Liens à usage unique, durée courte (invitation 48 h, réinitialisation 30 min), jamais de mot de passe dans un e-mail.
- Configuration SPF, DKIM et DMARC du domaine d'envoi (côté administrateur DNS).
- **Informations à fournir plus tard** : identifiant du locataire, identifiant et secret de l'application, adresse d'expédition. Ces secrets ne sont jamais committés (variables d'environnement / coffre).

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

### 4.1 Mise en œuvre (S3.3)
- **Décorateur `@Protected('permission', { stepUp?, minScope? })`** sur toute route métier ou d'administration : identité (jeton valide, session active) → **MFA vérifié** → **permission** → (optionnel) **MFA récent**. La permission est vérifiée **avant** le step-up. Une garde sans permission déclarée refuse. Un test parcourt **toutes** les routes montées et échoue si l'une est ouverte par oubli ou cite une permission absente du catalogue.
- **Droits lus en base à chaque requête**, jamais dans le jeton : un changement de rôle ou une désactivation agit immédiatement, y compris sur un jeton déjà émis.
- **Portée appliquée objet par objet** : liste filtrée selon Propre / Équipe (subordonnés **directs**) / Tous ; un objet hors portée est **introuvable (404)**, indiscernable d'un identifiant inexistant (OWASP A01, IDOR) ; un objet sans propriétaire n'est visible que de la portée Tous.
- **`minScope`** : une route qui agit sur *n'importe quel* utilisateur exige la portée **Tous** dès la garde (détenir la permission pour soi-même ne suffit pas).
- **Refus audités** (`ACCESS_DENIED`) avec la permission demandée ; le propriétaire d'un objet vient de l'identité, jamais du corps de la requête.
- **Invitation** : compte créé *sans mot de passe*, lien à usage unique de 48 h, jeton 256 bits haché, transmis dans le **fragment d'URL** ; l'utilisateur choisit son mot de passe, puis enrôle son MFA. **Aucun mot de passe connu d'un tiers n'existe avant l'activation.** Inviter avec des rôles exige le droit d'attribuer des rôles et un MFA récent.
- **Garde-fous d'administration** : pas d'auto-attribution de rôle, pas d'auto-désactivation, pas d'auto-réinitialisation du MFA, **au moins un SuperAdmin actif en permanence** (verrou de ligne : deux administrateurs agissant en même temps ne peuvent pas retirer les deux derniers), pas de cycle hiérarchique.
- **Défense CSRF globale** : toute requête qui *modifie* avec une origine non autorisée est refusée, sur toutes les routes (garde globale), en plus de `SameSite=Strict`.

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
Cartographie à établir (apprenants, contacts, employés dans l'ERP) ; minimisation ; accès restreint par rôle ; droit d'accès/effacement via soft delete puis **anonymisation** programmée (les lignes d'audit conservent l'identifiant technique, pas les données). **Conservation de l'audit : 10 ans** (décision du 2026-10-20), dont les **2 dernières années en ligne** (partitions mensuelles actives) et le reste **archivé à froid** (partitions détachées, chiffrées, restaurables) — découpage recommandé, à ajuster. À faire valider par le juridique au titre de la réglementation applicable. Volume estimé pour ~20 utilisateurs : ≈ 5 Mo/jour, soit moins de 2 Go par an. Autres durées (apprenants, contacts) : à valider avec le juridique.
Les apprenants **n'ont pas de compte** et n'interagissent pas avec le CRM : ce sont des fiches gérées par le personnel, d'où une exposition limitée (aucun portail, aucune authentification apprenant).

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
