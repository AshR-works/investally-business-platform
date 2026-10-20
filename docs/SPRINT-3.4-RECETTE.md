# Sprint 3.4 — Front de base : connexion, MFA, invitation, administration, mon compte (périmètre et plan de recette)

Durée : 1 semaine maximum. Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable · ⚠ vérifié partiellement. Validé quand tous les « Bloquant » sont ✅ **et** que l'ingénieur logiciel l'a explicitement validé.

## Périmètre
**Inclus** (pages web, françaises, accessibles au clavier, utilisables sur téléphone)
1. **Connexion** (`/login`) puis **second facteur** (`/mfa`) : saisie du code, ou d'un code de secours.
2. **Première configuration du MFA** : QR code généré dans le navigateur, clé manuelle, confirmation par un premier code, **affichage unique des 10 codes de secours** (copier, télécharger, case « conservés » obligatoire).
3. **Activation d'invitation** (`/invitation`) : choix du mot de passe à partir du lien reçu (jeton dans le fragment, effacé de l'adresse).
4. **Entreprises** (page d'accueil) : liste selon la portée de l'utilisateur et création (reprise de l'écran de S1, désormais authentifié).
5. **Administration des utilisateurs** (`/admin/users`) : liste, recherche, filtre de statut, pagination ; inviter ; renvoyer le lien ; modifier les rôles ; désactiver / réactiver ; réinitialiser le MFA ; couper les sessions. Chaque bouton n'apparaît que si le droit existe.
6. **Mon compte** (`/account`) : profil, changement de mot de passe, nouveaux codes de secours, mes sessions (révocation).
7. **Actions sensibles** : fenêtre de confirmation par code quand l'API exige un MFA récent.
8. **En-têtes de sécurité** du site.
9. Côté API : `GET /auth/me/profile` (nom, rôles, droits, état du MFA) et en-tête `WWW-Authenticate: invalid_token` sur les 401 dus au jeton.

**Exclus** : mot de passe oublié en libre-service (D21), documents (S3.5), écrans métier (S4+), maquettes (cadrage UX), tests de bout en bout automatisés (D22).

## Décisions techniques
| Sujet | Choix | Raison |
|---|---|---|
| Où vit le jeton d'accès | **Mémoire JavaScript seulement** ; cookie `HttpOnly` pour le rafraîchissement | Un script injecté ne peut pas lire un cookie `HttpOnly` ni un jeton absent du stockage du navigateur |
| Appels à l'API | Même origine : Next.js relaie `/api` vers `127.0.0.1:3001` | Pas de CORS, l'API reste invisible depuis l'extérieur |
| Rafraîchissement | Seulement sur un 401 qui accuse le **jeton** (RFC 6750) | Un mauvais code MFA rejoué serait compté **deux fois** contre le verrouillage (défaut trouvé en recette réelle) |
| Droits dans l'interface | Lus via `/auth/me/profile`, **confort seulement** | Le serveur re-contrôle chaque requête |
| QR code | Bibliothèque `qrcode` 1.5.4 **épinglée**, exécutée dans le navigateur | Le secret ne part vers aucun service tiers |
| Tests du front | `vitest` 5.0.5 (logique pure, sans navigateur simulé) + **recette réelle dans un navigateur** | Les écrans sont vérifiés par de vrais clics ; l'automatisation de bout en bout est la dette D22 |
| CSP | Stricte sauf `script-src 'unsafe-inline'` | Next.js sans nonce ; écart assumé et tracé (D20) |

## Plan de recette
| Réf. | Contrôle | Bloquant | Statut |
|---|---|---|---|
| A1 | Client HTTP : jeton envoyé en en-tête, jamais dans l'URL ; route publique sans jeton | Oui | ✅ |
| A2 | 401 dû au jeton : **un** rafraîchissement partagé puis **une** reprise ; échec du rafraîchissement : session perdue signalée, pas de boucle | Oui | ✅ |
| A3 | 401 **sans** `invalid_token` (mauvais code) : jamais rejoué, aucun rafraîchissement | Oui | ✅ |
| A4 | Step-up : une question à l'utilisateur pour plusieurs actions simultanées ; refus → erreur remontée ; 403 ordinaire sans question | Oui | ✅ |
| A5 | Le jeton n'est écrit ni dans `localStorage` ni dans `sessionStorage` | Oui | ✅ test + recherche dans le code |
| A6 | Lecture du lien d'invitation : fragment seulement, caractères et taille bornés | Oui | ✅ |
| A7 | Messages d'erreur : détail de l'API s'il est textuel ; jamais d'objet ni de trace affichés | Oui | ✅ |
| B1 | Visiteur anonyme → redirigé vers `/login` ; connecté sans MFA → `/mfa` ; connecté avec MFA → l'application | Oui | ✅ réel |
| B2 | Connexion refusée : « Identifiants invalides », mot de passe effacé | Oui | ✅ réel |
| B3 | Première configuration : QR affiché, clé manuelle, **un** appel de confirmation ; mauvais code refusé (**une seule** requête) ; bon code : 10 codes de secours | Oui | ✅ réel |
| B4 | « Continuer » désactivé tant que la case « codes conservés » n'est pas cochée ; avertissement avant de quitter la page | Oui | ✅ réel (bouton) · ⚠ avertissement du navigateur non observable par l'outil |
| B5 | Connexion suivante : code erroné refusé, code juste accepté | Oui | ✅ réel |
| B6 | Activation d'invitation : indications en direct (12 caractères), refus serveur affiché (mot de passe contenant l'identifiant), lien **conservé** après un refus, activation réussie | Oui | ✅ réel |
| B7 | Fragment du lien **effacé de la barre d'adresse** dès l'ouverture | Oui | ✅ réel |
| B8 | Lien rejoué : « Lien invalide ou expiré » ; page ouverte sans lien : « Lien invalide » | Oui | ✅ réel |
| B9 | Un chargé de compte : menu limité (Entreprises, Mon compte) ; ne voit **que** ses propres entreprises (0 sur 25 existantes, 1 après création) | Oui | ✅ réel |
| B10 | `/admin/users` sans droit : « Accès refusé », aucune donnée | Oui | ✅ réel |
| B11 | Administrateur : invitation envoyée (rôle, e-mail), compte « Invitation en attente » visible | Oui | ✅ réel |
| B12 | Mon compte : profil, nouveaux codes de secours (10), sessions (appareil lisible, « Cette session ») | Oui | ✅ réel |
| B13 | Déconnexion : retour à `/login`, session coupée côté serveur (204) | Oui | ✅ réel |
| B14 | Rechargement de la page : session conservée grâce au cookie | Oui | ✅ réel |
| B15 | **Step-up réel** : action sensible plus de 10 minutes après le dernier code → fenêtre de confirmation → action rejouée | Oui | ✅ réel (désactivation d'un compte à 22:49, 10 min 20 s après le code précédent : fenêtre affichée, code saisi, action rejouée, « Compte désactivé ») |
| C1 | Mise en page sur téléphone (375 px) : navigation, formulaires, tableau défilant | Non | ✅ réel |
| C2 | Aucune violation de la politique de contenu dans la console du navigateur | Oui | ✅ réel |
| C3 | En-têtes : CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP` présents | Oui | ✅ réel |
| D1 | Types propres (API et web), architecture : 128 modules, 492 dépendances, **0 violation** | Oui | ✅ |
| D2 | API : 353 unitaires + **132 intégration** (S1 à S3.3 inclus), tous verts ; route de profil protégée (test structurel des routes) | Oui | ✅ |
| D3 | Front : **24 tests**, tous verts | Oui | ✅ |
| D4 | `pnpm audit --prod` : aucune vulnérabilité haute ; 1 moyenne connue (js-yaml via Swagger, D6) | Oui | ✅ |
| D5 | Vérification par mutation du client HTTP (voir ci-dessous) | Oui | ✅ |

## Vérification par mutation (client HTTP)
| Mutant (contrôle cassé volontairement) | Détecté par |
|---|---|
| Tout 401 déclenche un rafraîchissement | test « 401 SANS invalid_token jamais rejoué » |
| Rafraîchissement non partagé entre requêtes simultanées | 3 tests |
| Step-up non partagé entre actions simultanées | test « UNE seule question » |
| Jeton écrit dans `localStorage` | 4 tests |

## Défauts trouvés et corrigés pendant le sprint
1. **Un mauvais code MFA était compté deux fois** contre le verrouillage du compte : mon client prenait le `401` pour un jeton expiré, se rafraîchissait puis **rejouait** la vérification. Découvert en lisant le journal réseau lors de la recette réelle (aucun test automatique ne pouvait le voir, car l'API seule se comporte correctement). Corrigé des deux côtés (en-tête RFC 6750 côté API, reprise conditionnelle côté client), testé et **vérifié de nouveau dans le navigateur** : une seule requête par tentative.
2. **Page d'administration affichée à un utilisateur sans droit** (cadre visible, puis « Accès refusé » en bas de page) : la page vérifie maintenant les droits avant tout affichage ni appel.
3. **Codes de secours perdus par un simple rechargement** pendant l'affichage unique : ajout d'un avertissement du navigateur avant de quitter la page (et possibilité de régénérer les codes depuis « Mon compte »).
4. **Libellé d'appareil illisible** (User-Agent brut) : résumé en « Chrome sur Windows » (bulle d'aide avec le détail).
5. **Tableau trop haut sur téléphone** (boutons d'action empilés) : largeur minimale de la colonne d'actions.
6. **Incident d'environnement (mon fait)** : en redémarrant les serveurs de recette, la clé de chiffrement MFA de test avait été régénérée, rendant illisibles les secrets MFA enregistrés. Sans conséquence (base jetable), la clé est maintenant persistée pour la durée de la recette.

## Limites connues
- **Aucun test automatisé des écrans** : les parcours ci-dessus ont été joués à la main dans un vrai navigateur (D22).
- **Pas de « mot de passe oublié »** (D21) : seul un administrateur peut renvoyer un lien à un compte en attente ; un compte actif qui perd son mot de passe n'a pas encore de parcours de récupération. **Décision attendue** (registre, D15).
- **Pas de vraie application d'authentification testée** : les codes de recette sont calculés par un programme (algorithme standard, vecteurs RFC validés en S3.2).
- **Pas de Microsoft 365** : l'invitation est lue dans la console de développement.
- CSP avec `'unsafe-inline'` pour les scripts (D20).
- Le rafraîchissement du jeton se fait au premier refus après 15 minutes (D24).
- Aucune adaptation de la durée de session côté interface : l'écran de connexion réapparaît quand la session absolue expire.
- Les écrans n'ont pas été relus par un spécialiste de l'accessibilité : étiquettes, focus, rôles `alert`/`status` et fenêtres modales sont en place, mais aucun lecteur d'écran n'a été utilisé.

## Décision de validation
Tous les contrôles bloquants sont ✅. **Validation explicite de l'ingénieur logiciel requise** avant fusion dans `main` et tag `s3-4-validated`.
