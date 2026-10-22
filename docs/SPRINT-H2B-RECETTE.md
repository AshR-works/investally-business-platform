# H2b — Sessions et historique des connexions : recette

*Branche `sprint/h2b-sessions-et-historique` · 2026-10-22 · décisions du cadrage H2 : **CAD-H2-1 A** (historique lu dans le journal d'audit), **CAD-H2-2 A** (visible par l'intéressé seulement), **CAD-H2-3 B** (deux lots : H2a livré et validé, H2b = ce lot). Écrans S01 à S03.*

## Ce qui est livré
### API (seule nouveauté côté serveur de H2)
| Route | Rôle | Garde-fous |
|---|---|---|
| `GET /auth/sessions/history` | Mes connexions réussies et échouées sur **90 jours**, du plus récent au plus ancien, pagination par curseur (`limit` ≤ 100, `before`) | Identité tirée **du jeton seulement** : aucun identifiant d'utilisateur n'est accepté (`?userId=` → 400) ; permission `iam.session.read` ; `Cache-Control: no-store` ; aucune table nouvelle (lecture du journal d'audit en ajout seul) |
| `POST /auth/sessions/revoke-others` | Déconnecte **tous mes autres appareils**, la session courante reste ouverte | **MFA récent exigé** (step-up) ; cible = l'appelant, jamais lue dans la requête ; jetons de rafraîchissement révoqués ; action **auditée** (`SESSION_REVOKE`, `other_sessions_revoked`, nombre) |

Ce que l'historique **ne montre pas** : le motif précis d'un échec (compte inconnu, verrouillé, inactif…) — seulement « identifiants refusés » ou « second facteur refusé » ; aucun identifiant de session ni valeur d'audit ; aucune localisation. Les tentatives sur une adresse inconnue n'y figurent pas (aucun compte à qui les rattacher).

### Interface (nouvelle page `/account/sessions`, lien depuis « Mon compte »)
- **S01 Sessions actives** : appareil lisible, adresse IP, **niveau de risque** (texte + teinte), « Cette session », dates.
- **S02 Historique des connexions** : date, résultat (réussie / échec et étape), IP, appareil ; « Voir les connexions plus anciennes » ; état vide.
- **S03 Révocation** : fenêtre de confirmation pour une session ou pour « tous mes autres appareils » ; le code MFA est redemandé par l'interface si le MFA n'est plus récent ; résultat annoncé (`role="status"`).

## Preuves
| Contrôle | Résultat |
|---|---|
| API, tests unitaires | **391 / 391** (dont 11 nouveaux : lecture et bornes de l'historique, aucune fuite de motif, révocation des autres sessions sans toucher les autres utilisateurs) |
| API, tests d'intégration (PostgreSQL jetable) | **149 / 149** (dont 8 nouveaux : mon historique et pas celui des autres, ordre, pagination disjointe, paramètres invalides refusés, 401 sans jeton, 403 sans second facteur, révocation des autres sessions, **step-up obligatoire sans rien révoquer**, aucune cible dans la requête) |
| Matrice des droits (rôle × route) | Mise à jour : 2 routes ajoutées, toutes les permissions et le step-up vérifiés pour chaque rôle ; `route-protection` : aucune route ouverte par oubli |
| Architecture | **0 violation** (130 modules) |
| Mutants | **4 / 4 tués** : filtre utilisateur supprimé de la lecture ; session courante révoquée avec les autres ; step-up retiré de la route ; motif d'échec exposé |
| Interface | **62 / 62** tests ; typage sans erreur |
| Navigateur réel, audit axe-core | **33 états, 0 violation**, dont sessions et historique, les deux fenêtres de confirmation, révocation d'une session puis de toutes les autres (il reste exactement 1 session, la courante) |
| Politique de contenu (CSP) | 0 violation |

**À vérifier à la main (2, mêmes causes)** : axe ne peut pas déterminer le fond du paragraphe des deux fenêtres de confirmation (« recouvrement partiel »). Contrôle manuel : texte `#1D1D1B` sur fond blanc, soit un contraste d'environ 17 : 1 (clair) ; thème sombre couvert par les mêmes jetons déjà audités.

Captures : `docs/accessibilite/h2b-captures/` (`sessions`, `sessions-revocation`, `sessions-apres`).

## Écarts et points d'attention
- **Adresse IP** : c'est celle que le serveur voit. En production, derrière un proxy, elle n'est exacte que si `TRUST_PROXY` est configuré correctement (dette D40, à vérifier en S7).
- **Avis juridique** sur la conservation et l'affichage des adresses IP et appareils : **toujours à obtenir** (Étape 0). La fenêtre de 90 jours et la visibilité réservée à l'intéressé sont les mesures de minimisation retenues en attendant.
- Pas de vue administrateur de l'historique (décision CAD-H2-2 A) ; extensible sans migration si la direction produit le décide.
- Nombre de codes de secours restants (D39) : non traité, en attente de votre décision.
- L'écoute avec un vrai lecteur d'écran (D31) doit couvrir : les six cases du code, les tableaux de sessions et d'historique, les fenêtres de confirmation.

## À valider
« Je valide H2b » → fusion `--no-ff` dans `main` et étiquette `h2b-validated`. Cela clôt H2 (EXD-06 réalisée : A01 à A15 et S01 à S03).
