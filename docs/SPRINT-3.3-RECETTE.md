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
| A1 | Utilisateur invité : sans mot de passe, `PENDING`, ne peut pas s'authentifier ; l'activation pose le mot de passe | oui | ⏳ |
| A2 | Invitation : valide / expirée / utilisée / révoquée ; frontière exacte à 48 h | oui | ⏳ |
| A3 | Hiérarchie : refus d'un cycle (A→B→A), refus d'être son propre responsable | oui | ⏳ |
| A4 | Entreprise : propriétaire défini à la création, jamais vide | oui | ⏳ |

## B. Application (faux en mémoire)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| B1 | Résolution des droits : union des rôles, portée la plus large, aucun droit sans rôle, compte désactivé = aucun droit | oui | ⏳ |
| B2 | Invitation : crée le compte `PENDING`, envoie l'e-mail (lien dans le fragment), jeton **jamais** en clair en base ni dans l'audit ; échec d'envoi : compte créé, renvoi possible | oui | ⏳ |
| B3 | Acceptation : mot de passe soumis à la politique ; jeton à usage unique ; expiré/utilisé/révoqué/inconnu : même refus générique | oui | ⏳ |
| B4 | Renvoi : révoque les jetons précédents | oui | ⏳ |
| B5 | Attribution de rôles : refus pour soi-même, audit `ROLE_CHANGE` avant/après, effet immédiat | oui | ⏳ |
| B6 | Désactivation : sessions et jetons révoqués ; refus pour soi-même ; refus pour le dernier SuperAdmin actif | oui | ⏳ |
| B7 | Retrait du rôle SuperAdmin au dernier SuperAdmin refusé | oui | ⏳ |
| B8 | Modification du responsable : refus d'un cycle | oui | ⏳ |
| B9 | Portée d'une entreprise : Propre / Équipe (responsable direct seulement) / Tous ; hors portée : introuvable | oui | ⏳ |
| B10 | Mes sessions : je ne vois et ne révoque que les miennes | oui | ⏳ |

## C. Base de données (PostgreSQL jetable)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| C1 | Migration 0004 sur une base déjà remplie (données S1 → S3.3 préservées) | oui | ⏳ |
| C2 | Invitation : jeton unique, cascade avec l'utilisateur, contraintes | oui | ⏳ |
| C3 | Deux acceptations simultanées du même lien : une seule réussit | oui | ⏳ |
| C4 | Désactivation d'un utilisateur ayant des sessions actives : toutes révoquées en base | oui | ⏳ |
| C5 | Deux administrateurs retirant en même temps le rôle SuperAdmin aux deux derniers : au moins un reste (course) | oui | ⏳ |
| C6 | Listes filtrées par portée sur la vraie base (Propre, Équipe, Tous) | oui | ⏳ |

## D. HTTP de bout en bout — matrice générée à partir de la matrice de rôles
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| D1 | **Chaque rôle (10) × chaque route protégée** : autorisé exactement quand la matrice le prévoit, 403 sinon ; la matrice est lue depuis `ROLE_GRANTS`, pas réécrite | oui | ⏳ |
| D2 | Sans jeton : 401 ; jeton sans MFA : `MFA_REQUIRED` ; MFA périmé sur action sensible : `MFA_STEP_UP_REQUIRED` | oui | ⏳ |
| D3 | IDOR : un chargé de compte ne lit/modifie jamais l'entreprise d'un collègue (404) ; un responsable voit celles de ses subordonnés directs, pas celles des petits-enfants | oui | ⏳ |
| D4 | Parcours d'invitation complet : invitation → e-mail → acceptation → connexion → enrôlement MFA | oui | ⏳ |
| D5 | Désactivation : le jeton d'accès et le cookie de la personne sont refusés immédiatement | oui | ⏳ |
| D6 | Changement de rôle : effet immédiat sur le jeton déjà émis | oui | ⏳ |
| D7 | Aucune réponse n'expose de hachage, secret, jeton d'invitation ou secret MFA | oui | ⏳ |
| D8 | Pagination bornée (≤ 100), recherche, paramètres invalides refusés | oui | ⏳ |
| D9 | Contrôle d'origine (CSRF) sur toutes les routes d'écriture | oui | ⏳ |
| D10 | Les 403 génèrent une ligne d'audit `ACCESS_DENIED` | oui | ⏳ |

## E. Qualité
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| E1 | Types ; règles d'architecture ; tous les tests précédents (S1 à S3.2) toujours verts | oui | ⏳ |
| E2 | Aucun endpoint métier n'est resté sans protection (test qui parcourt **toutes** les routes de l'application) | oui | ⏳ |
| E3 | `pnpm audit --prod` : aucune vulnérabilité haute | non | ⏳ |
| E4 | Revue de sécurité (IDOR, énumération, auto-élévation, course de dernier SuperAdmin, fuite dans les réponses et journaux) | oui | ⏳ |
| E5 | Vérification par mutation des contrôles critiques (portée, auto-attribution, dernier SuperAdmin) | oui | ⏳ |

## Dette et limites connues (à compléter en fin de sprint)
- Pas encore de front : l'invitation est un lien dans un e-mail dont la page n'existe qu'en S3.4.
- Envoi d'e-mail non vérifié contre le vrai Microsoft 365 (D9 du registre).
