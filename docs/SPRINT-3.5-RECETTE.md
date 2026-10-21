# Sprint 3.5 — « Mot de passe oublié », commentaires du code et livrables (périmètre et plan de recette)

Durée : 1 semaine maximum. Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable · ⚠ vérifié partiellement. Validé quand tous les « Bloquant » sont ✅ **et** que l'ingénieur logiciel l'a explicitement validé.

## Origine et ajustement du plan
- **Demande du 2026-10-21** : « Rajoute un bouton mot de passe oublié qui devra s'exécuter de manière sécurisée et traçable. » Elle remplace ma recommandation initiale (réinitialisation par un administrateur seulement) par le **libre-service**, que j'avais classé « possible plus tard » parce qu'il exige davantage de protections. Ces protections sont **toutes** livrées ici.
- **Demande du 2026-10-21** : « des livrables pour récapituler les réalisations avec commentaires » et « des commentaires sur les différentes fonctions créées dans l'application ».
- **Plan** : ce sprint prend le numéro S3.5 ; **les documents passent en S3.6**. S3.4 (interface de base) n'est toujours pas fusionné : S3.5 est construit **au-dessus** de S3.4 et ne pourra être fusionné qu'après lui.

## Périmètre
**Inclus**
1. **Bouton « Mot de passe oublié ? »** sur la page de connexion → page de demande (`/forgot-password`) → e-mail → page de choix du mot de passe (`/reset-password`).
2. **Libre-service** : lien de **60 minutes**, réponse identique pour toute adresse, plafonds, audit.
3. **Déclenchement par un administrateur** : bouton « Réinitialiser le mot de passe » dans l'administration (permission `iam.user.reset_password`, MFA récent, jamais pour soi-même), lien de 48 h.
4. **Effet** : mot de passe changé, **toutes les sessions coupées**, **MFA conservé**, e-mail de confirmation au titulaire.
5. **Traçabilité** : action d'audit `PASSWORD_RESET` (demande et issue, émission, usage, refus).
6. **Commentaires** sur toutes les classes, fonctions, interfaces et composants du code.
7. **Livrables** dans `docs/livrables/` : récapitulatif des réalisations, guide du code, index des fonctions (généré), versions HTML imprimables.

**Exclus** : notification de changement de mot de passe après un changement fait depuis « Mon compte » (D27), file durable pour l'envoi des e-mails (D26), limite par IP dédiée (D25), documents (S3.6).

## Décisions techniques
| Sujet | Choix | Raison |
|---|---|---|
| Mécanisme du lien | Même table et mêmes protections que l'invitation, champ `purpose` (`INVITATION` ou `PASSWORD_RESET`) | Une seule implémentation du jeton à usage unique à auditer ; un lien ne peut pas servir à autre chose que son usage |
| Anti-énumération | Réponse **202 identique**, traitement **après** la réponse | Ni le contenu ni le temps de réponse ne révèlent si un compte existe |
| Durée du lien | **60 min** (libre-service), **48 h** (administrateur) | Plus le déclencheur est anonyme, plus le lien doit être court |
| Plafonds | 3/minute par IP + adresse ; **3/heure par compte** (base de données, avec verrou) | Pas d'inondation de boîte e-mail, même depuis plusieurs IP |
| MFA | **Conservé** | Le lien seul ne doit jamais donner un accès : le second facteur reste la barrière |
| Audit | Action dédiée `PASSWORD_RESET` (migration : valeur ajoutée à l'énumération) | Retrouver en une requête toutes les réinitialisations |
| Adresses inconnues | **Jamais** écrites dans l'audit | Éviter d'y stocker des saisies arbitraires (données personnelles, injection de contenu) |
| Commentaires | JSDoc en français sur toute déclaration ; index **généré** par script | L'index ne peut pas dériver du code |

## Plan de recette
| Réf. | Contrôle | Bloquant | Statut |
|---|---|---|---|
| A1 | Demande : e-mail avec lien dans le **fragment**, 60 min exactement, empreinte seule en base, jeton absent de l'audit | Oui | ✅ |
| A2 | Adresse inconnue, mal formée, vide, compte en attente ou désactivé : **rien n'est envoyé**, aucune différence visible pour l'appelant | Oui | ✅ |
| A3 | Une adresse inconnue **n'apparaît jamais** dans le journal d'audit (ni du texte injecté) | Oui | ✅ |
| A4 | Plafond : 3 liens par heure et par compte, refus silencieux audité (`THROTTLED`), reprise après une heure (borne testée à la milliseconde) | Oui | ✅ |
| A5 | Nouvelle demande : le lien précédent est révoqué | Oui | ✅ |
| A6 | Échec d'envoi : jamais d'erreur pour l'appelant, échec audité ; transaction en échec : aucun lien utilisable | Oui | ✅ |
| B1 | Succès : nouveau mot de passe actif, ancien refusé, historique à jour | Oui | ✅ |
| B2 | **Toutes les sessions et tous les jetons de rafraîchissement coupés** | Oui | ✅ |
| B3 | **MFA conservé** : après réinitialisation, la connexion exige toujours le second facteur | Oui | ✅ |
| B4 | Verrouillage de compte levé par la réinitialisation | Oui | ✅ |
| B5 | Audit (terminée, sessions coupées, IP) ; e-mail de confirmation avec la date et l'adresse IP, sans mot de passe | Oui | ✅ |
| B6 | Usage unique ; **deux usages simultanés : un seul aboutit** (course sur la base) | Oui | ✅ |
| B7 | Mot de passe faible / contenant l'identité / déjà utilisé : refusé **sans consommer** le lien | Oui | ✅ |
| B8 | Expiration à 60 minutes ; tous les liens non valides produisent **le même refus** | Oui | ✅ |
| B9 | **Usage croisé** : un lien d'invitation ne réinitialise pas, un lien de réinitialisation n'active pas | Oui | ✅ |
| B10 | Compte désactivé entre la demande et l'usage : lien refusé | Oui | ✅ |
| C1 | Administrateur : lien de 48 h, audité avec son identité, lien fonctionnel | Oui | ✅ |
| C2 | Interdit pour soi-même ; refus pour un compte inconnu, en attente ou désactivé ; MFA périmé = step-up exigé ; rôle sans droit = 403 ; sans jeton = 401 | Oui | ✅ |
| D1 | HTTP réel : réponses **identiques** (statut, corps, en-têtes) pour compte connu / inconnu / mal formé | Oui | ✅ |
| D2 | HTTP réel : limitation 3/minute (429 ensuite), autre IP non touchée ; entrées mal formées rejetées (400) | Oui | ✅ |
| D3 | HTTP réel : parcours complet, ancienne session coupée, ancien mot de passe refusé, nouveau accepté + MFA exigé, audit `ISSUED` puis `password_reset_completed` | Oui | ✅ |
| E1 | **Navigateur réel** : lien sur la page de connexion → demande → message identique → ouverture du lien → fragment effacé de l'adresse → mot de passe **réutilisé refusé** (message clair, lien conservé) → mot de passe neuf accepté → « Mot de passe modifié » | Oui | ✅ réel |
| E2 | Après E1 : ancien mot de passe refusé (401), nouveau accepté (200), e-mail de confirmation émis, 3 lignes d'audit (demande, refus, usage) | Oui | ✅ réel |
| F1 | Types propres (API et web) ; architecture : **129 modules, 506 dépendances, 0 violation** | Oui | ✅ |
| F2 | **380** tests unitaires API (353 + 27 nouveaux) · **141** tests d'intégration (132 + 9 nouveaux) · **24** tests web, tous verts ; test structurel des routes mis à jour (32 routes) | Oui | ✅ |
| F3 | Migration `20261024000000_s3_5_password_reset` appliquée sur base vide ; invitations existantes conservées comme `INVITATION` | Oui | ✅ |
| G1 | Vérification par mutation (voir ci-dessous) | Oui | ✅ 12 sur 12 détectées, **après correction d'un test trop faible** |
| H1 | **Commentaires** : 0 déclaration non commentée (script de contrôle), **535 déclarations** dans l'index généré ; l'ancien commentaire périmé de `main.ts` corrigé | Non | ✅ |
| H2 | **Livrables** : récapitulatif, guide du code, index des fonctions, versions HTML | Non | ✅ |

## Vérification par mutation
| Mutant (contrôle cassé volontairement) | Détecté par |
|---|---|
| M1 un lien d'invitation peut réinitialiser un mot de passe (usage croisé permis) | **Survécu** au premier jeu de tests (le compte invité n'étant pas actif, une autre règle le refusait) → test de **défense en profondeur** ajouté (lien d'invitation rattaché à un compte actif) ; **détecté ensuite** |
| M2 plafond de 3 liens par heure supprimé | « plafond : 3 liens par heure et par compte… » |
| M3 sessions non coupées après la réinitialisation | 2 tests (audit des sessions coupées ; sessions et jetons de rafraîchissement) |
| M4 historique des mots de passe non vérifié | « refusé sans consommer le lien » |
| M5 une nouvelle demande ne révoque plus l'ancien lien | « une nouvelle demande révoque le lien précédent » |
| M6 un administrateur peut réinitialiser son propre mot de passe | « INTERDIT pour soi-même » |
| M7 l'adresse inconnue est écrite dans l'audit | « une adresse inconnue n'est JAMAIS écrite dans le journal d'audit » |
| M8 consommation atomique du lien ignorée | « deux utilisations simultanées : une seule aboutit » |
| M9 lien libre-service de 120 minutes au lieu de 60 | 2 tests (durée à la milliseconde ; expiration) |
| M10 un compte désactivé peut recevoir un lien | 3 tests (inéligible, désactivé entre demande et usage, administrateur) |
| M11 politique de mot de passe vérifiée après consommation du lien | « refusé sans consommer le lien » |
| M12 le titulaire n'est plus prévenu par e-mail | « l'opération est auditée… et le titulaire reçoit un e-mail » |

**Enseignement** : M1 montre qu'un test peut « passer » parce qu'une *autre* règle protège déjà. Seule la mutation l'a révélé.

## Défauts trouvés et corrigés pendant le sprint
1. **Tests d'intégration trop impatients** (ma faute) : le traitement continue après la réponse (volontairement), mes premiers tests lisaient l'audit au bout de 300 ms et échouaient sur une machine lente. Les tests **attendent maintenant** l'e-mail ou l'audit (jusqu'à 15 s) et le délai d'un test est relevé à 30 s. La logique n'a pas changé.
2. **Borne du plafond horaire** : un lien créé *pile* une heure plus tôt compte encore. Le test le vérifie à la milliseconde plutôt que d'accepter une borne floue.
3. **Commentaire périmé** : `main.ts` affirmait que le MFA et le contrôle d'accès n'étaient « pas branchés » ; corrigé.
4. **Mutant survivant M1** (voir ci-dessus) : test ajouté.
5. **Premier passage complet des tests d'intégration sous charge** : 4 échecs de *délai* (transaction non démarrée à temps, tests dépassant 5 s ou 60 s) dans des tests de S3.3, pendant que la machine exécutait d'autres tâches lourdes. **Aucun n'a reproduit** : la même suite passe seule (10/10) puis en entier au calme (**141/141**). Noté honnêtement comme fragilité de l'environnement de test (machine lente), pas comme défaut de code ; à surveiller.
6. **Incident d'outil de recette** : le navigateur intégré **suspend les requêtes réseau quand son panneau est masqué** (`ERR_NETWORK_IO_SUSPENDED`) ; une soumission de formulaire n'est pas partie. Elle a été rejouée panneau visible. Aucun lien avec le code livré, noté pour ne pas le confondre avec un défaut.

## Limites connues
- **Microsoft 365 non testé** : le lien est lu dans la console de développement (option réservée au développement, refusée en production).
- **Traitement après la réponse, en mémoire** (D26) : une panne du processus entre la réponse et l'envoi perd la demande ; l'utilisateur redemande.
- **Nuisance possible** (D25) : redemander des liens pour une adresse connue invalide le lien légitime de la victime (3 fois par heure au plus) ; tracé, non bloquant.
- **Pas de notification** après un changement fait depuis « Mon compte » (D27).
- Si le **téléphone est aussi perdu**, un administrateur doit en plus réinitialiser le MFA (D14) ; les deux actions sont possibles et tracées.
- Les écrans restent vérifiés à la main (D22).

## Décision de validation
Tous les contrôles bloquants sont ✅ (141/141 tests d'intégration au calme ; voir défaut 5 pour le passage sous charge). **Validation explicite de l'ingénieur logiciel requise.** Ordre de fusion : **S3.4 d'abord, puis S3.5** (S3.5 contient S3.4).
