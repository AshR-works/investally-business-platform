# Sprint 3.1 — Authentification (périmètre et plan de recette)

Durée : 1 semaine maximum. Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable. Le sprint est validé quand tous les « Bloquant » sont ✅ **et** que l'ingénieur logiciel l'a validé explicitement.

## Périmètre
**Inclus** : création d'un utilisateur (use case interne, sans API publique), politique de mot de passe, hachage argon2id, connexion, jeton d'accès JWT ES256, sessions avec niveau de risque, jeton de rafraîchissement à rotation et détection de réutilisation, déconnexion, verrouillage progressif, limitation de débit, journalisation des tentatives, audit des connexions, en-têtes de sécurité (helmet), garde d'authentification (`/auth/me`, `/auth/logout`).

**Exclus (sprints suivants)** :
- **S3.2** : MFA (TOTP, codes de secours, step-up), envoi d'e-mails Microsoft 365, création du premier SuperAdmin.
- **S3.3** : autorisation par permissions et portées sur les endpoints métier, API d'administration des utilisateurs et rôles, pages web de connexion.

## ⚠ Limite de sécurité assumée jusqu'à S3.3
Le MFA est obligatoire pour tous (décision) mais n'existe qu'en S3.2. En S3.1 le jeton émis porte `amr = ["pwd"]` : **mot de passe seul, MFA non vérifié**. Aucun endpoint métier n'exige encore ce jeton (S3.3). **L'API reste donc locale (127.0.0.1) et ne doit pas être exposée.**

## Décisions techniques
| Sujet | Choix | Raison |
|---|---|---|
| Hachage | `@node-rs/argon2` (argon2id, binaire précompilé) | Spécifié dans SECURITY.md ; `crypto.argon2` n'existe pas dans Node 22 (cible LTS) |
| JWT | `jose` 5.10 (CommonJS), ES256 | Bibliothèque de référence ; v6 est ESM seul, incompatible avec Jest/CommonJS du projet |
| Limitation de débit | `@nestjs/throttler`, stockage mémoire | Une seule instance ; à remplacer par un stockage partagé si plusieurs instances |
| Cookie refresh | `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` | SECURITY.md §2.2. `Secure` désactivé seulement en développement local |
| Clés de signature | Variables d'environnement ; en développement/test, paire éphémère générée au démarrage avec avertissement ; **refus de démarrer en production sans clés** | Jamais de clé dans le dépôt |
| Liste de mots de passe courants | Liste embarquée courte (~100) en S3.1 | **Limite connue** : à remplacer par une liste de 10 000 en S7 (dette notée) |

## A. Domaine (tests sans base)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| A1 | Politique de mot de passe : longueur 12–128, refus courants, refus dérivés de l'e-mail/nom, refus des 5 derniers | oui | ✅ 10 tests (comptage des caractères Unicode, aucun écho du mot de passe) |
| A2 | Utilisateur : verrouillage progressif (5 échecs → 1, 5, 15, 60 min, plafonné), jamais définitif, remise à zéro après succès, compte désactivé refusé | oui | ✅ 11 tests (paliers 1/5/15/60 min vérifiés, plafond, remise à zéro) |
| A3 | Session : expiration sur inactivité et absolue (12 h privilégiés), révocation, glissement borné par l'expiration absolue | oui | ✅ 9 tests (inactivité 8 h, absolu 12 h/7 j, glissement borné) |
| A4 | Rotation du refresh token : valide → nouveau jeton ; déjà utilisé → réutilisation détectée, famille et session révoquées ; expiré/révoqué → refus | oui | ✅ 6 tests (ROTATE, EXPIRED, REVOKED, CONCURRENT, REUSED) |
| A5 | Niveau de risque : nouvel appareil, nouvelle IP, échecs récents, rôle privilégié ; réutilisation = CRITICAL | oui | ✅ 12 tests (table de scores, réutilisation = CRITICAL) |

## B. Application (faux en mémoire)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| B1 | Connexion réussie : session, jeton d'accès, refresh token, audit `LOGIN`, tentative enregistrée | oui | ✅ |
| B2 | Mauvais mot de passe : message unique « Identifiants invalides », compteur incrémenté, audit `LOGIN_FAILED` | oui | ✅ |
| B3 | E-mail inconnu : **même** message et même chemin de calcul (hachage factice) — pas d'énumération | oui | ✅ calcul factice exécuté, e-mail absent de l'audit |
| B4 | Compte verrouillé : refus même avec le bon mot de passe pendant le verrou ; message identique | oui | ✅ y compris levée du verrou après 1 minute |
| B5 | Rafraîchissement : rotation OK ; réutilisation → toute la session révoquée + audit `SESSION_REVOKE` | oui | ✅ y compris : le jeton légitime issu de la rotation est lui aussi révoqué |
| B6 | Déconnexion : session et jetons révoqués, audit `LOGOUT` | oui | ✅ idempotente, jeton d'accès refusé immédiatement |
| B7 | Création d'utilisateur : applique la politique, stocke un hachage (jamais le mot de passe), historise le hachage | oui | ✅ |

## C. Infrastructure et base (PostgreSQL jetable)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| C1 | Utilisateur, session, jetons, tentatives persistés ; horodatages UTC | oui | ✅ écart horodatage/horloge < 10 s (UTC) |
| C2 | Le mot de passe en clair n'apparaît **nulle part** (base, audit, logs) | oui | ✅ aucun secret ni hachage dans l'audit ; jeton de rafraîchissement stocké seulement en SHA-256 |
| C3 | Le hachage vérifie le bon mot de passe et refuse le mauvais ; sel unique par hachage | oui | ✅ argon2id m=19456,t=2,p=1 ; sel unique ; hachage corrompu refusé sans exception |
| C4 | Le jeton JWT est signé ES256, vérifié ; refusé si falsifié, expiré, `alg: none`, mauvaise clé, mauvais `aud`/`iss` | oui | ✅ 12 attaques : falsification, signature tronquée, alg:none, HS256, autre clé, mauvais émetteur/audience, claims mal typés, entrées absurdes |
| C5 | Réutilisation d'un refresh token : concurrence (deux requêtes simultanées avec le même jeton) → une seule gagne | oui | ✅ deux rafraîchissements simultanés : un seul réussit, la session survit |

## D. HTTP de bout en bout
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| D1 | `POST /auth/login` OK → 200, jeton dans le corps, refresh token **uniquement** en cookie `HttpOnly; SameSite=Strict` | oui | ✅ cookie HttpOnly, SameSite=Strict, Path=/api/v1/auth ; jamais dans le corps |
| D2 | `POST /auth/refresh` avec cookie → nouveau jeton, cookie remplacé ; sans cookie → 401 | oui | ✅ cookie bidon : 401 et cookie effacé |
| D3 | `GET /auth/me` avec/sans/avec jeton falsifié → 200 / 401 / 401 | oui | ✅ 7 variantes d'en-tête invalides, jeton falsifié |
| D4 | `POST /auth/logout` → 204 ; le jeton d'accès est ensuite refusé (session révoquée) | oui | ✅ jeton ET cookie refusés immédiatement après |
| D5 | Limitation de débit : la 6e tentative de connexion en 1 minute → 429 avec `Retry-After` | oui | ✅ 6e tentative : 429 + Retry-After, y compris avec le bon mot de passe ; autre compte non touché |
| D6 | En-têtes de sécurité présents (`X-Content-Type-Options`, `Strict-Transport-Security`, pas de `X-Powered-By`) | oui | ✅ sur /health/live et /auth/me |
| D7 | Réponses d'erreur d'authentification : jamais de détail interne ni de trace | oui | ✅ route inconnue, JSON cassé : aucune trace |

## E. Contrôles de qualité
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| E1 | Types sans erreur ; règles d'architecture (Domain pur, frontières de module) | oui | ✅ types propres ; 92 modules, 287 dépendances, 0 violation |
| E2 | Tous les tests précédents (S1, S2) toujours verts | oui | ✅ 136 unitaires + 57 intégration ; migration S1 vers S2 toujours préservée |
| E3 | `pnpm audit --prod` : aucune vulnérabilité haute | non | ✅ 0 vulnérabilité haute ; 1 moyenne (js-yaml via Swagger, dette D6 inchangée) |
| E4 | Revue de sécurité du code d'authentification (comparaisons en temps constant, aucun secret loggé, aucun `Math.random`) | oui | ✅ voir « Revue de sécurité » ci-dessous |

## Dette et limites connues (non bloquantes)
- MFA absent (S3.2) ; jetons `amr = ["pwd"]`.
- Liste de mots de passe courants courte (S7).
- Limitation de débit en mémoire (un seul processus).
- Détection d'IP « nouvelle » par préfixe (/24 en IPv4) : approximation, pas de géolocalisation.
- Pas de rotation automatique des clés de signature (S7).

## Tests ajoutés par rapport au plan
- Politique : le mot de passe n'est jamais repris dans les messages d'erreur.
- Concurrence : 12 connexions échouées parallèles. **Vérifié par mutation** : sans `SELECT … FOR UPDATE`, le test échoue (10 tentatives enregistrées sur 12, deux requêtes perdues).
- Origine (CSRF) : origine inconnue → 403 ; origine autorisée ou absente → acceptée.
- Changement de mot de passe : historique des 5 derniers, autres sessions révoquées, audit sans mot de passe.
- Configuration : la production refuse de démarrer sans clés, sans origines, ou avec un cookie non sécurisé.
- Journaux : une erreur Prisma ne journalise jamais ses valeurs (hachage, e-mail).

## Revue de sécurité (E4)
| Point | Constat |
|---|---|
| Aléa | Aucun `Math.random` ; jetons de rafraîchissement par `crypto.randomBytes` (256 bits) |
| Comparaisons de secrets | Mots de passe : `argon2.verify` ; jetons JWT : vérification de signature `jose` ; jeton de rafraîchissement : recherche par empreinte SHA-256 indexée (la valeur secrète n'est jamais comparée) |
| Journaux | Aucun secret journalisé. **Défaut corrigé pendant la revue** : les erreurs Prisma embarquent les valeurs de la requête (hachage) ; seuls le nom et le code sont désormais écrits |
| SQL | Un seul SQL brut (`FOR UPDATE`), en *tagged template* paramétré |
| Énumération de comptes | Même message, même code, même corps, hachage factice ; y compris pour un compte verrouillé ou désactivé |
| Production | Démarrage réel du build : refus sans clés (code 1) ; avec clés : santé OK, Swagger 404, HSTS et nosniff présents ; base injoignable : 500 générique sans détail |

## Défauts trouvés et corrigés pendant le sprint
1. **Fuite potentielle dans les journaux** (erreurs Prisma) : corrigé et testé.
2. **Test trompeur** : un faux hachage reprenait le jeton en clair et faisait échouer à tort le test « seule l'empreinte est stockée ». Le faux est devenu opaque.
3. **Test mal écrit** (longueur Unicode) : un remplacement sans effet. Remplacé par un vrai test (6 émojis = 12 unités UTF-16 mais 6 caractères).
4. **Swagger** monté hors de la configuration testée : déplacé pour que les tests couvrent exactement ce qui tourne.

## Limites connues (à décider ou à traiter)
- **MFA absent** : jetons `amr = ["pwd"]`, `mfaVerified = false`. Aucun endpoint métier ne les exige avant S3.3 ; **ne pas exposer l'API**.
- **Verrouillage utilisable contre une victime** : un attaquant qui connaît l'e-mail peut maintenir un compte verrouillé en échouant 5 fois (1 min, puis jusqu'à 60 min). Compromis assumé (SECURITY.md §2.4, jamais définitif) ; la limitation de débit réduit l'effet mais ne l'annule pas depuis plusieurs IP.
- **Limitation de débit en mémoire** : valable pour une seule instance.
- **Liste de mots de passe courants courte** (~100) : à remplacer par 10 000 entrées (S7).
- **Pas de rotation automatique des clés de signature** (S7) ; une seule clé active.
- **Base injoignable : 500** (pas 503) : à affiner en S7.
- **`req.ip` derrière le proxy Next.js** : sans `TRUST_PROXY=loopback`, toutes les requêtes semblent venir de 127.0.0.1 (limitation de débit et audit imprécis). À régler au déploiement.
- Les endpoints métier (`/companies`) restent **sans authentification** jusqu'à S3.3.

## Décision de validation
Tous les contrôles bloquants sont ✅. **Reste la validation explicite de l'ingénieur logiciel** avant fusion dans `main` et tag `s3-1-validated`.
