# Sprint 3.3 — Autorisation, administration des comptes et invitations (périmètre et plan de recette)

Durée : 1 semaine maximum. Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable · ⚠ vérifié partiellement. Validé quand tous les « Bloquant » sont ✅ **et** que l'ingénieur logiciel l'a validé explicitement.

## Ajustement du plan (à confirmer)
Le plan prévoyait en S3.3 le contrôle d'accès **et** le front de base. Les deux ne tiennent pas dans une semaine sans sacrifier la rigueur : **S3.3 livre le backend**, et un nouveau **S3.4** livre le front de base (connexion, scan du QR MFA, codes de secours, administration des utilisateurs). Les documents passent en S3.5. Aucune autre phase n'est modifiée.

## Périmètre
**Inclus**
1. **Autorisation par permission et portée** appliquée côté serveur : décorateur `@Protected('permission')` (authentification + MFA vérifié + permission), portées Propre / Équipe / Tous, **404 (et non 403) pour un objet hors portée** (pas d'énumération), audit `ACCESS_DENIED`.
2. **Première vraie application sur le métier** : les endpoints `/companies` exigent une identité, un MFA vérifié et la permission ; une entreprise a un **propriétaire** (`owner_user_id`) qui détermine la portée.
3. **API d'administration** (`/admin`) : lister/consulter les utilisateurs, inviter, renvoyer une invitation, modifier, désactiver/réactiver, **attribuer les rôles** (step-up), **réinitialiser le MFA** (step-up), **révoquer toutes les sessions** d'un utilisateur (step-up), lister les rôles et leurs permissions.
4. **Mes sessions** : lister et révoquer ses propres sessions.
5. **Invitation par e-mail** : le compte est créé **sans mot de passe** ; l'utilisateur le choisit lui-même via un lien à usage unique valable 48 h (jeton haché, transmis dans le fragment d'URL). **Cela ferme la limite D13** (première inscription au MFA protégée par le seul mot de passe) : aucun mot de passe connu d'un tiers n'existe avant l'activation.
6. **Garde-fous d'administration** : jamais d'auto-attribution de rôle, jamais de désactivation de soi-même, jamais de suppression du dernier SuperAdmin actif, pas de cycle hiérarchique.

**Exclus** : pages web (S3.4) ; documents (S3.5) ; autres modules métier (S4+).

## Décisions techniques
| Sujet | Choix | Raison |
|---|---|---|
| Où l'autorisation s'applique | Garde de route (« a-t-il la permission ? ») **puis** filtrage/contrôle par portée dans le cas d'usage | Défense en profondeur ; la portée dépend de l'objet |
| Permissions de l'utilisateur | Résolues **à chaque requête** depuis la base (jamais dans le jeton) | Un changement de rôle ou une désactivation prend effet immédiatement (SECURITY.md §2.2) |
| Objet hors portée | **404** | Ne révèle pas l'existence de l'objet (OWASP A01, IDOR) |
| Action sans permission | 403 + audit `ACCESS_DENIED` | Traçabilité des tentatives |
| Propriétaire d'une entreprise | `bd.companies.owner_user_id`, **sans clé étrangère** (référence inter-contextes, ARCHITECTURE.md) | Cohérent avec « aucune FK entre schémas » |
| Entreprises existantes sans propriétaire | Visibles seulement des rôles en portée **Tous** | Aucune fuite vers Propre/Équipe |
| Invitation | Jeton 256 bits, haché SHA-256, 48 h, usage unique, dans le **fragment** `#` de l'URL | Un fragment n'est pas envoyé aux serveurs ni dans les en-têtes Referer |
| Désactivation | Révoque aussitôt toutes les sessions et jetons | Accès coupé immédiatement |

## Migration (0004)
`bd.companies.owner_user_id UUID` + index · `iam.user_invitations` (jeton haché unique, expiration, usage, révocation). Aucune donnée existante modifiée.

## A. Domaine (sans base)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| A1 | Utilisateur invité : sans mot de passe, `PENDING`, ne peut pas s'authentifier ; l'activation pose le mot de passe | oui | ✅ 7 tests (sans mot de passe, activation, usage unique, désactivé, réactivation) |
| A2 | Invitation : valide / expirée / utilisée / révoquée ; frontière exacte à 48 h | oui | ✅ 4 tests (48 h exactes à la milliseconde, utilisée/révoquée, priorités) |
| A3 | Hiérarchie : refus d'un cycle (A→B→A), refus d'être son propre responsable | oui | ✅ 5 tests (soi-même, cycle direct, cycle indirect) |
| A4 | Entreprise : propriétaire défini à la création, jamais vide | oui | ✅ |

## B. Application (faux en mémoire)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| B1 | Résolution des droits : union des rôles, portée la plus large, aucun droit sans rôle, compte désactivé = aucun droit | oui | ✅ les 10 rôles reçoivent exactement la matrice ; cumul de rôles ; sans rôle = aucun droit ; effet immédiat d'un changement de rôle |
| B2 | Invitation : crée le compte `PENDING`, envoie l'e-mail (lien dans le fragment), jeton **jamais** en clair en base ni dans l'audit ; échec d'envoi : compte créé, renvoi possible | oui | ✅ lien dans le fragment, jeton absent de la base et de l'audit, échéance 48 h ; échec d'envoi : compte créé, `emailSent=false`, échec audité, renvoi possible |
| B3 | Acceptation : mot de passe soumis à la politique ; jeton à usage unique ; expiré/utilisé/révoqué/inconnu : même refus générique | oui | ✅ 5 cas d'échec (inconnu, vide, expiré, utilisé, révoqué) : **un seul** refus identique ; mot de passe refusé = lien conservé |
| B4 | Renvoi : révoque les jetons précédents | oui | ✅ renvoi sur compte actif ou inconnu refusé |
| B5 | Attribution de rôles : refus pour soi-même, audit `ROLE_CHANGE` avant/après, effet immédiat | oui | ✅ avant/après/ajoutés/retirés audités ; auto-attribution refusée, SuperAdmin compris |
| B6 | Désactivation : sessions et jetons révoqués ; refus pour soi-même ; refus pour le dernier SuperAdmin actif | oui | ✅ sessions et jetons révoqués, jeton d'accès refusé aussitôt ; réactivation seulement d'un compte désactivé qui a un mot de passe |
| B7 | Retrait du rôle SuperAdmin au dernier SuperAdmin refusé | oui | ✅ refus pour le dernier SuperAdmin actif ; un SuperAdmin désactivé ne compte pas |
| B8 | Modification du responsable : refus d'un cycle | oui | ✅ soi-même, direct, indirect refusés ; retrait du responsable (`null`) ; audit avant/après |
| B9 | Portée d'une entreprise : Propre / Équipe (responsable direct seulement) / Tous ; hors portée : introuvable | oui | ✅ 10 tests : Propre, Équipe (directs seulement), Tous ; orphelines réservées à la portée Tous ; recherche et pagination bornées à la portée ; hiérarchie modifiée = portée modifiée aussitôt |
| B10 | Mes sessions : je ne vois et ne révoque que les miennes | oui | ✅ liste filtrée, session courante signalée, révocation d'une session d'autrui = introuvable ; « toutes les sessions » réservé à la portée Tous |

## C. Base de données (PostgreSQL jetable)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| C1 | Migration 0004 sur une base déjà remplie (données S1 → S3.3 préservées) | oui | ✅ 40 lignes d'audit, 1 utilisateur et 1 session conservés à l'identique ; entreprises existantes sans propriétaire |
| C2 | Invitation : jeton unique, cascade avec l'utilisateur, contraintes | oui | ✅ jeton non SHA-256 refusé, doublon refusé, expiration antérieure refusée, cascade avec l'utilisateur |
| C3 | Deux acceptations simultanées du même lien : une seule réussit | oui | ✅ une seule acceptation sur deux simultanées ; une entrée d'historique |
| C4 | Désactivation d'un utilisateur ayant des sessions actives : toutes révoquées en base | oui | ✅ 3 sessions et tous les jetons révoqués en base |
| C5 | Deux administrateurs retirant en même temps le rôle SuperAdmin aux deux derniers : au moins un reste (course) | oui | ✅ **deux courses** (retrait de rôle croisé, désactivation croisée) : il reste toujours un SuperAdmin ; **vérifié par mutation** |
| C6 | Listes filtrées par portée sur la vraie base (Propre, Équipe, Tous) | oui | ✅ liste de propriétaires restreint ; liste vide = rien ; sans liste = tout, orphelines comprises |

## D. HTTP de bout en bout — matrice générée à partir de la matrice de rôles
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| D1 | **Chaque rôle (10) × chaque route protégée** : autorisé exactement quand la matrice le prévoit, 403 sinon ; la matrice est lue depuis `ROLE_GRANTS`, pas réécrite | oui | ✅ **160 combinaisons** (10 rôles × 16 routes) : autorisé exactement quand la matrice du code le prévoit |
| D2 | Sans jeton : 401 ; jeton sans MFA : `MFA_REQUIRED` ; MFA périmé sur action sensible : `MFA_STEP_UP_REQUIRED` | oui | ✅ sans jeton : 401 sur 16 routes ; mot de passe seul : `MFA_REQUIRED` sur 16 routes (SuperAdmin compris) ; MFA périmé : `MFA_STEP_UP_REQUIRED` sur les actions sensibles ; la permission est vérifiée **avant** le step-up |
| D3 | IDOR : un chargé de compte ne lit/modifie jamais l'entreprise d'un collègue (404) ; un responsable voit celles de ses subordonnés directs, pas celles des petits-enfants | oui | ✅ propriétaire = acteur (champ `ownerUserId` envoyé : 400) ; 5 accès hors portée donnent 404, **corps identique** à un identifiant inexistant |
| D4 | Parcours d'invitation complet : invitation → e-mail → acceptation → connexion → enrôlement MFA | oui | ✅ parcours complet sur HTTP **et sur le serveur compilé** (voir « Vérification réelle ») |
| D5 | Désactivation : le jeton d'accès et le cookie de la personne sont refusés immédiatement | oui | ✅ jeton d'accès, cookie de rafraîchissement et connexion refusés aussitôt |
| D6 | Changement de rôle : effet immédiat sur le jeton déjà émis | oui | ✅ même jeton : création d'entreprise passe de 201 à 403 après retrait du rôle ; audit `ROLE_CHANGE` |
| D7 | Aucune réponse n'expose de hachage, secret, jeton d'invitation ou secret MFA | oui | ✅ aucun hachage, secret, jeton ni compteur interne dans 5 réponses d'administration ; `Cache-Control: no-store` |
| D8 | Pagination bornée (≤ 100), recherche, paramètres invalides refusés | oui | ✅ taille > 100, page < 1, recherche > 100 caractères, statut inconnu : 400 ; injections dans la recherche traitées comme du texte |
| D9 | Contrôle d'origine (CSRF) sur toutes les routes d'écriture | oui | ✅ les 15 routes d'écriture refusent une origine inconnue (403), même sans jeton ; la lecture n'est pas concernée |
| D10 | Les 403 génèrent une ligne d'audit `ACCESS_DENIED` | oui | ✅ pour chaque rôle, le nombre de lignes `ACCESS_DENIED` égale le nombre de refus |

## E. Qualité
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| E1 | Types ; règles d'architecture ; tous les tests précédents (S1 à S3.2) toujours verts | oui | ✅ types propres ; 127 modules, 486 dépendances, 0 violation ; **353 unitaires + 130 intégration** (S1 à S3.2 inclus) |
| E2 | Aucun endpoint métier n'est resté sans protection (test qui parcourt **toutes** les routes de l'application) | oui | ✅ test qui parcourt les **28 routes** réellement montées : 5 publiques, 7 « authentifiées seulement », 16 protégées par permission du catalogue ; ordre des gardes vérifié |
| E3 | `pnpm audit --prod` : aucune vulnérabilité haute | non | ✅ 0 haute ; 1 moyenne (js-yaml via Swagger, dette D6) |
| E4 | Revue de sécurité (IDOR, énumération, auto-élévation, course de dernier SuperAdmin, fuite dans les réponses et journaux) | oui | ✅ voir « Revue de sécurité » |
| E5 | Vérification par mutation des contrôles critiques (portée, auto-attribution, dernier SuperAdmin) | oui | ✅ 9 mutants détectés (voir « Vérification par mutation ») |

## Vérification réelle sur le serveur compilé
Commande `admin:create` réelle, puis : l'administrateur enrôle son MFA (code TOTP calculé) → jeton `pwd+otp` ; une route métier avec le jeton « mot de passe seul » donne `403 MFA_REQUIRED` ; invitation d'un collègue (`emailSent: true`, compte `PENDING`) ; lien lu dans la console de développement (jeton dans le fragment `#token=`, 43 caractères) ; activation `204` ; **même lien rejoué : 400 « Lien invalide ou expiré »** ; le collègue se connecte, enrôle son MFA, crée une entreprise (il en est propriétaire) ; `GET /admin/users` par le collègue : `403 FORBIDDEN` ; le SuperAdmin lit l'entreprise du collègue (200) ; une entreprise inexistante donne 404. Journal du serveur : **0** occurrence du mot de passe. Production : refus de démarrer sans `APP_PUBLIC_URL`, avec une URL `http`, ou avec `EMAIL_LOG_CONTENT=true` ; configuration complète : démarre en 2 s, Swagger 404, routes métier et d'administration 401 sans jeton.

## Revue de sécurité (E4)
| Point | Constat |
|---|---|
| Contrôle d'accès (A01) | Test structurel sur les 28 routes ; permission du catalogue obligatoire ; ordre identité → MFA → permission → step-up ; **la permission est vérifiée avant le step-up** |
| IDOR | Objet hors portée = 404 indiscernable d'un identifiant inexistant ; entreprise orpheline refusée aux portées Propre et Équipe |
| Mass assignment | Champs inconnus refusés (`forbidNonWhitelisted`) ; le propriétaire vient de l'identité, jamais du corps |
| Auto-élévation | Rôles, désactivation et réinitialisation MFA interdits sur soi-même, SuperAdmin compris |
| Dernier SuperAdmin | Verrou de ligne sur le rôle ; deux courses testées et vérifiées par mutation |
| Invitation | Jeton 256 bits haché ; fragment d'URL ; 48 h ; usage unique atomique ; refus identique pour tous les liens invalides ; mot de passe choisi par l'utilisateur |
| Fuites | Aucun champ interne dans les vues ; `no-store` ; jeton d'invitation uniquement dans l'e-mail (et dans la console en développement avec option explicite, interdite en production) |
| SQL | 3 `SELECT … FOR UPDATE` en *tagged template* paramétré ; recherche paramétrée |
| Journaux | Aucun journal dans les couches Application et Présentation de l'IAM |
| Défaut trouvé en revue | **Inviter un utilisateur avec des rôles ne demandait ni le droit d'attribuer des rôles ni un MFA récent** : une session d'administrateur détournée aurait pu inviter un SuperAdmin. Corrigé (droit `assign_role` vérifié dans le cas d'usage + step-up) et testé |

## Défauts trouvés et corrigés pendant le sprint
1. **Confusion `undefined` / `null` dans ma règle de décision de S2** : un objet existant sans propriétaire était traité comme une simple liste, donc accessible aux portées Propre et Équipe. Repéré avant d'écrire le code métier, corrigé et testé (le test échoue si on remet l'ancienne règle).
2. **Route trop permissive détectée par la matrice** : la Direction détient `iam.session.revoke` en portée « propre » et franchissait donc la garde de « révoquer toutes les sessions d'un autre utilisateur », avant d'être refusée plus loin avec un message flou. Ajout de `minScope` à `@Protected` : cette route exige désormais la portée **Tous** dès la garde.
3. **Invitation sans step-up ni droit d'attribution** (revue) : voir ci-dessus.
4. **Violations d'architecture détectées par le contrat** : mes contrôleurs importaient le Domain directement ; les types ont été exposés par la couche Application.
5. **Tests trop stricts ou erronés de ma part** : seuil arbitraire du nombre de routes (28 réelles), attente d'une liste vide pour un rôle sans permission (la réponse correcte est 403), exigence qu'un rôle soit refusé sur des routes ouvertes à tous.
6. **Anciens tests de S1** supposant des routes publiques : ils attendent maintenant 401, ce qui est précisément le comportement voulu.
7. **Incident de procédure (mon outil de mutation)** : deux mutants visaient le même fichier et la restauration a échoué à mi-chemin, laissant du code muté. Détecté immédiatement, réparé depuis Git, vérifié (aucun `.orig`, aucun marqueur de mutation, écart limité aux changements voulus), script corrigé. Aucune trace dans les livrables.

## Vérification par mutation (E5)
| Mutant (contrôle cassé volontairement) | Détecté par |
|---|---|
| Objet sans propriétaire traité comme une liste | tests de politique + 4 tests de portée |
| Auto-attribution de rôles autorisée | « INTERDIT de modifier ses propres rôles » |
| Liste d'entreprises sans filtre de portée | 6 tests de portée (Propre, Équipe, total, recherche, formateur) |
| Dernier SuperAdmin non vérifié | 3 tests (retrait de rôle ×2, désactivation) |
| Lecture d'une entreprise sans contrôle d'accès | 3 tests IDOR |
| Verrou du dernier SuperAdmin retiré | les **2 courses** de la base |
| Garde de permission désactivée | 9 rôles de la matrice + step-up + IDOR + effet immédiat |
| Portée minimale ignorée (**mutant isolé**) | 9 rôles de la matrice (tous sauf SuperAdmin) |

## Limites connues (à décider ou à traiter)
- **Pas de front** : l'invitation est un lien dont la page n'existe qu'en S3.4. En développement, `EMAIL_LOG_CONTENT=true` affiche le lien dans la console.
- **Microsoft 365 jamais testé en réel** (registre D9).
- **Modifier le responsable d'un utilisateur change qui voit quoi** (portée Équipe) mais n'exige pas de step-up ; l'action est auditée. À décider.
- **Les entreprises créées avant S3.3 n'ont pas de propriétaire** : seuls les rôles en portée Tous les voient. Il n'existe pas encore de moyen de leur en attribuer un (S4.1).
- **Pas de réattribution d'une entreprise** à un autre propriétaire (S4.1) ; un salarié qui part garde « ses » entreprises tant qu'on ne les réattribue pas.
- **La portée Équipe inclut les subordonnés directs désactivés ou en attente**, donc leurs entreprises restent visibles de leur responsable.
- **Durées de session des rôles privilégiés** : un changement de rôle s'applique aux droits immédiatement, mais la durée absolue de session (12 h) ne change qu'au prochain renouvellement.
- **Droits relus à chaque requête** (2 requêtes SQL) : sans cache, volontairement (révocation immédiate) ; largement suffisant pour ≈ 20 utilisateurs.
- **Pas de révocation explicite d'une invitation** hors renvoi ou désactivation du compte.
- Limitation de débit en mémoire, une seule instance (dette D8).

## Décision de validation
Tous les contrôles bloquants sont ✅. **Reste la validation explicite de l'ingénieur logiciel** avant fusion dans `main` et tag `s3-3-validated`.
