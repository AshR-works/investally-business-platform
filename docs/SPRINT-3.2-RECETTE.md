# Sprint 3.2 — MFA, e-mail Microsoft 365 et premier SuperAdmin (périmètre et plan de recette)

Durée : 1 semaine maximum. Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable · ⚠ vérifié partiellement. Validé quand tous les « Bloquant » sont ✅ **et** que l'ingénieur logiciel l'a validé explicitement.

## Périmètre
**Inclus**
- **MFA TOTP** (RFC 6238), obligatoire pour tous (ADR-0006) : enrôlement (secret, URI `otpauth`), confirmation, vérification à la connexion, **step-up** (MFA récent < 10 min), **10 codes de secours** à usage unique, régénération, **réinitialisation** par un administrateur (cas d'usage ; l'API d'administration arrive en S3.3).
- **Secret TOTP chiffré au repos** (AES-256-GCM, clé hors base, lié à l'utilisateur), **anti-rejeu** d'un même code, **anti-force brute** sur les codes.
- **Port `EmailSender`** + adaptateur **Microsoft Graph** + adaptateur « journal » (développement et test, aucun envoi réel).
- **Création du premier SuperAdmin** par une commande d'exploitation (aucun mot de passe par défaut).
- Garde `RequireRecentMfa` prête pour S3.3.

**Exclus** : OTP par e-mail et récupération en libre-service (la perte du téléphone passe par une réinitialisation par un SuperAdmin, décision ADR-0006) ; flux d'invitation et de réinitialisation de mot de passe par e-mail (S3.3) ; autorisation par permission (S3.3) ; pages web (S3.3).

## ⚠ Ce qui ne peut pas être vérifié ici
- **L'envoi réel via Microsoft 365** : je n'ai ni locataire, ni application enregistrée, ni boîte d'expédition. L'adaptateur est testé contre un faux serveur (format des requêtes, jeton, erreurs) mais **jamais contre le vrai service**. À valider dès que les accès existent (voir `QUESTIONS-ET-DECISIONS.md` D9).
- **La compatibilité avec une vraie application d'authentification** (Microsoft Authenticator, Google Authenticator) : les codes sont validés contre les **vecteurs de test officiels de la RFC 6238**, mais je n'ai pas scanné de QR avec un téléphone. À faire lors de la recette humaine.

## Décisions techniques
| Sujet | Choix | Raison |
|---|---|---|
| TOTP | Implémentation propre sur `node:crypto` (HMAC-SHA1, 6 chiffres, pas de 30 s, fenêtre ±1), validée par les vecteurs de la RFC 6238 | ≈ 30 lignes, aucune dépendance supplémentaire ; SHA-1 imposé par la compatibilité des applications d'authentification |
| Chiffrement du secret | AES-256-GCM, IV aléatoire de 96 bits, **AAD = identifiant utilisateur** (un secret copié sur un autre compte est indéchiffrable) | Intégrité et liaison au compte |
| Clé de chiffrement | `MFA_ENCRYPTION_KEY` (32 octets en base64) ; **obligatoire en production** ; éphémère en développement et test | Jamais de clé dans le dépôt |
| Anti-rejeu | Colonne `mfa_last_used_step` : un code ne peut servir qu'une fois, ni un pas antérieur | RFC 6238 §5.2 |
| Force brute MFA | Les échecs MFA comptent dans le même compteur et le même verrouillage progressif que les échecs de mot de passe + limitation 5/min sur la vérification | Un attaquant qui connaît le mot de passe ne peut pas deviner les codes |
| Codes de secours | 10 codes de 10 caractères (alphabet sans ambiguïté, ≈ 50 bits), hachés argon2id, consommés atomiquement | Récupération sans téléphone, sans second canal faible |
| Step-up | `mfa_verified_at` sur la session ; fraîcheur maximale 10 min | SECURITY.md §2.3 |
| Perte du téléphone | Réinitialisation par un SuperAdmin (révoque toutes les sessions, supprime secret et codes) | ADR-0006 ; pas d'OTP e-mail en S3.2 |

## Migration (0003)
`iam.users.mfa_last_used_step BIGINT` · `iam.user_sessions.mfa_verified_at TIMESTAMPTZ`. Aucune donnée existante modifiée.

## A. Domaine (sans base)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| A1 | Base32 (RFC 4648) : aller-retour, rejet des caractères invalides | oui | ✅ vecteurs officiels RFC 4648 §10 (7) ; caractères invalides rejetés |
| A2 | TOTP conforme aux **vecteurs officiels de la RFC 6238** (SHA-1, 6 chiffres) ; fenêtre ±1 ; refus hors fenêtre ; zéros initiaux conservés | oui | ✅ vecteurs officiels RFC 6238 (6 instants, 8 chiffres) et RFC 4226 (10 compteurs) ; fenêtre ±1 ; zéros initiaux conservés ; 61 tests |
| A3 | Anti-rejeu : un code déjà utilisé, ou d'un pas antérieur, est refusé | oui | ✅ même pas et pas antérieur refusés, pas postérieur accepté |
| A4 | Utilisateur : enrôlement en attente ≠ activé ; réinitialisation ; échecs MFA verrouillent comme les échecs de mot de passe | oui | ✅ 13 tests (enrôlement en attente, confirmation, réinitialisation, compteur d'échecs partagé avec le mot de passe) |
| A5 | Session : MFA vérifié horodaté ; fraîcheur du step-up (frontière à 10 min) | oui | ✅ frontière exacte à 10 min ; horodatage futur jamais « récent » |
| A6 | Codes de secours : format, unicité, normalisation de la saisie (casse, tirets, espaces) | oui | ✅ alphabet sans ambiguïté, normalisation, saisies impossibles rejetées |

## B. Application (faux en mémoire)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| B1 | Enrôlement : secret chiffré stocké, URI otpauth correcte, **le secret n'apparaît jamais dans l'audit** | oui | ✅ secret chiffré lié à l'utilisateur, absent de l'audit |
| B2 | Confirmation : bon code → MFA activé + 10 codes de secours (affichés une seule fois) + session vérifiée ; mauvais code → refus, MFA non activé | oui | ✅ 10 codes distincts, jeton `pwd+otp` ; mauvais code : MFA inactif, échec compté |
| B3 | Connexion d'un compte MFA : `mfaEnrolled`, session non vérifiée ; la vérification ajoute `otp` au jeton | oui | ✅ l'ancien jeton (mot de passe seul) reste non vérifié |
| B4 | Vérification : rejeu refusé ; code faux compté et verrouillant après 5 échecs ; message générique | oui | ✅ rejeu, verrouillage au 5e échec partagé avec le mot de passe, formats absurdes |
| B5 | Code de secours : valable une fois, consommé atomiquement, audit ; déjà utilisé refusé | oui | ✅ casse/tirets/espaces acceptés ; un code ne sert qu'une fois ; calcul factice sur saisie impossible |
| B6 | Step-up : met à jour l'horodatage ; la garde refuse au-delà de 10 min | oui | ✅ 9 min fraîche, 11 min vérifiée mais plus fraîche, step-up la rafraîchit |
| B7 | Régénération des codes : exige un step-up ; anciens codes invalidés | oui | ✅ MFA_STEP_UP_REQUIRED au-delà de 10 min ; anciens codes invalides |
| B8 | Réinitialisation par admin : secret et codes supprimés, toutes les sessions révoquées, audit `MFA_CHANGE` | oui | ✅ 2 sessions révoquées, secret et codes supprimés, ancien code inutilisable, réenrôlement possible |
| B9 | Un utilisateur ne peut pas désactiver son propre MFA (obligatoire) | oui | ✅ auto-réinitialisation interdite ; remplacement d'un MFA actif refusé (409) |

## C. Infrastructure et base (PostgreSQL jetable)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| C1 | Migration 0003 s'applique ; migration depuis une base déjà remplie (S1 → S3.2) | oui | ✅ migration S3.2 appliquée sur base remplie (40 lignes d'audit, 1 utilisateur, 1 session conservés à l'identique) ; migration S1→S2 toujours préservée |
| C2 | AES-256-GCM : aller-retour ; **liaison à l'utilisateur** (déchiffrement refusé avec un autre identifiant) ; altération détectée ; deux chiffrements du même secret diffèrent | oui | ✅ 11 tests : liaison à l'utilisateur, altération de chiffré/étiquette/IV, mauvaise clé, format, clé éphémère, refus en production sans clé |
| C3 | Le secret TOTP n'est **jamais** en clair en base ni dans l'audit ni dans les journaux | oui | ✅ vérifié en base, dans l'audit, les tentatives, les sessions ET sur un serveur réel (journal serveur : 0 occurrence du secret et du code) |
| C4 | Consommation d'un code de secours : deux requêtes simultanées, une seule réussit | oui | ✅ deux consommations directes : une seule vraie ; même code de secours depuis deux sessions : une seule réussit (vérifié par mutation) |
| C5 | Rejeu concurrent d'un même code TOTP : une seule requête réussit | oui | ✅ même code TOTP depuis deux sessions simultanées : une seule réussit ; 12 vérifications fausses parallèles : aucun échec perdu (vérifié par mutation) |
| C6 | Création du premier SuperAdmin : rôle SUPER_ADMIN, mot de passe jamais affiché ni stocké en clair | oui | ✅ test + **vraie commande** sur le build compilé : refuse mot de passe en argument, sans mot de passe, faible, doublon ; création réussie |

## D. Microsoft 365 (contre un faux serveur)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| D1 | Jeton d'application (client credentials) : requête conforme, mise en cache jusqu'à expiration (− marge) | oui | ✅ jeton client credentials conforme, mis en cache, renouvelé 2 min avant l'expiration |
| D2 | `sendMail` : corps conforme (destinataire, sujet, contenu), réponse 202 attendue | oui | ✅ corps conforme (texte et HTML), `saveToSentItems:false`, 202 exigé |
| D3 | Jeton rejeté (401) : un seul nouvel essai, puis erreur | oui | ✅ un seul nouvel essai, pas de boucle |
| D4 | Erreurs : le secret client et le jeton n'apparaissent jamais dans les messages ni les journaux | oui | ✅ 5 scénarios d'échec : ni secret client, ni jeton, ni contenu du message dans les journaux |
| D5 | Injection d'en-têtes : adresse ou sujet contenant CR/LF refusés | oui | ✅ 13 messages invalides (CR/LF, adresses multiples, nom affiché…) refusés sans appel réseau ; expéditeur encodé dans l'URL |
| D6 | Délai d'attente borné | oui | ✅ chaque appel porte un AbortSignal ; délai dépassé : UNAVAILABLE |
| D7 | Adaptateur journal : n'envoie rien, ne journalise pas le contenu des messages | oui | ✅ n'envoie rien, aucun contenu ni adresse complète dans les journaux, mémoire bornée à 50 |
| D8 | **Envoi réel vers Microsoft 365** | non | ➖ accès non disponibles |

## E. HTTP de bout en bout
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| E1 | Parcours complet : connexion → enrôlement → confirmation → déconnexion → connexion → vérification TOTP → `amr = [pwd, otp]` | oui | ✅ parcours complet sur HTTP avec de vrais codes TOTP ; secret jamais renvoyé ailleurs qu'à l'enrôlement |
| E2 | Code erroné : 401 générique ; 6e tentative en 1 min : 429 | oui | ✅ 401 générique, 429 + Retry-After à la 6e tentative ; limite par session (un collègue de la même IP n'est pas bloqué) |
| E3 | Code de secours via HTTP ; régénération avec step-up | oui | ✅ code de secours via HTTP ; MFA_REQUIRED / MFA_STEP_UP_REQUIRED / succès après step-up |
| E4 | Sans jeton : 401 sur toutes les routes MFA | oui | ✅ 4 routes × (sans jeton, jeton falsifié) |
| E5 | Contrôle d'origine (CSRF) sur les routes MFA | oui | ✅ 4 routes refusées depuis une origine inconnue ; origine autorisée acceptée |

## F. Qualité
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| F1 | Types ; règles d'architecture ; tests S1, S2, S3.1 toujours verts | oui | ✅ types propres ; 110 modules, 367 dépendances, 0 violation ; **277 unitaires + 91 intégration** (S1, S2, S3.1 inclus) |
| F2 | Build de production : refuse de démarrer sans `MFA_ENCRYPTION_KEY` ni fournisseur e-mail valide | oui | ✅ 5 refus réels (clé MFA absente ou de mauvaise taille, e-mail absent/« log », Microsoft 365 incomplet) ; production complète : démarre en 2 s, Swagger 404 |
| F3 | `pnpm audit --prod` : aucune vulnérabilité haute | non | ✅ 0 haute ; 1 moyenne (js-yaml via Swagger, dette D6) |
| F4 | Revue de sécurité du code MFA (secret jamais journalisé, comparaisons en temps constant, aléa cryptographique) | oui | ✅ voir « Revue de sécurité » |

## Revue de sécurité (F4)
| Point | Constat |
|---|---|
| Secret TOTP | Généré par `crypto.randomBytes` (160 bits) ; chiffré AES-256-GCM avec l'identifiant de l'utilisateur comme donnée authentifiée ; en clair uniquement dans la réponse de démarrage d'enrôlement ; jamais en base, audit, tentatives, sessions ni journaux (vérifié sur serveur réel) |
| Codes de secours | `crypto.randomInt` (pas de biais) ; 50 bits ; hachés argon2id ; consommés atomiquement ; jamais dans l'audit |
| Comparaisons | Codes TOTP : `timingSafeEqual` sur tous les pas de la fenêtre (pas de sortie anticipée) ; codes de secours : `argon2.verify` |
| Aléa | Aucun `Math.random` |
| Journaux | Aucun secret, code ni contenu d'e-mail ; la commande d'administration n'affiche jamais le mot de passe ; `seed:core` n'affiche plus que le message d'erreur (corrigé pendant la revue) |
| SQL brut | Deux `SELECT … FOR UPDATE` en *tagged template* paramétré |
| Énumération et timing | Même message « Code invalide » pour code faux, format invalide, verrouillage ; calcul factice quand la saisie ne peut pas être un code de secours |
| Mot de passe de la commande | Jamais en argument (refusé explicitement) ; variable d'environnement ou saisie masquée ; aucun défaut |

## Défauts trouvés et corrigés pendant le sprint
1. **Tests aléatoires que j'avais écrits** : deux tests supposaient que le pas de temps TOTP ne change pas pendant leur exécution (environ 1 à 3 % d'échecs au passage d'une frontière de 30 s). Rendus déterministes (pas lu en base, pas calculé une seule fois).
2. **Arithmétique de test fausse** sur la marge du cache de jeton Microsoft (le code était juste).
3. **Mot de passe d'exemple refusé à raison** par la politique (il contenait un mot du nom affiché) : le test a été corrigé, pas la règle.
4. **Caractères de séparation de ligne Unicode littéraux** introduits dans un fichier source par mon outil d'écriture (U+2028), qui cassaient l'analyse d'une expression régulière : remplacés par des séquences d'échappement.
5. **Affichage d'erreur complet dans `seed:core`** (pouvait contenir des valeurs de requête) : limité au message.
6. **Script de mise à niveau** : testait seulement S1→S2 ; généralisé (toutes les migrations précédentes, données IAM incluses).

## Vérification par mutation
Retrait temporaire du verrou de ligne et de l'atomicité de la consommation des codes de secours : les tests « 12 vérifications parallèles » et « consommation atomique » **échouent**, donc ils détectent bien le défaut. Les tests de course « de bout en bout » (même code depuis deux sessions) restent verts sous cette mutation parce que le **verrou optimiste** (`version` de l'utilisateur) forme une seconde défense : sans le verrou de ligne, la requête perdante échoue avec un conflit au lieu d'un refus propre. Défense en profondeur confirmée, rien à corriger.

## Limites connues (à décider ou à traiter)
- **Première inscription au MFA protégée par le seul mot de passe** (« confiance à la première utilisation ») : quelqu'un qui connaît le mot de passe d'un compte **jamais enrôlé** peut y enrôler son propre appareil avant le vrai titulaire ; celui-ci verra alors son MFA déjà actif, ne pourra pas se connecter, et devra demander une réinitialisation. Atténuation prévue : en S3.3, l'enrôlement sera lié à un lien d'invitation envoyé par e-mail. D'ici là : l'administrateur enrôle immédiatement après la création du compte.
- **Microsoft 365 jamais testé en réel** (voir plus haut) ; une seule tentative après un 401 ; pas d'outbox ni de disjoncteur (dette D11).
- **Compatibilité avec une vraie application d'authentification non vérifiée** : codes conformes aux vecteurs RFC, QR jamais scanné.
- **Pas de récupération en libre-service** : la perte du téléphone passe par un SuperAdmin (décision ADR-0006) ; l'API d'administration (`iam.user.reset_mfa`) arrive en S3.3, le cas d'usage existe déjà.
- **Une seule clé de chiffrement MFA** active (rotation en S7, dette D12) ; la perdre rend tous les secrets inutilisables (tous les utilisateurs devraient se réenrôler) : à sauvegarder dans un coffre.
- **Limitation de débit MFA en mémoire**, valable pour une seule instance (dette D8) ; l'identifiant de session y est lu **sans vérifier la signature** (documenté : sert uniquement de clé).
- **SHA-1** dans le TOTP : imposé par la compatibilité des applications d'authentification (RFC 6238), sans faiblesse pratique pour ce usage.
- Les endpoints métier restent **sans authentification** jusqu'à S3.3 : **ne pas exposer l'API**.

## Décision de validation
Tous les contrôles bloquants sont ✅. **Reste la validation explicite de l'ingénieur logiciel** avant fusion dans `main` et tag `s3-2-validated`. Vérification humaine recommandée avec un vrai téléphone (Microsoft Authenticator) lors de la recette utilisateur de S3.3.
