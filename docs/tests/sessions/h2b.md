# Fiche de test — H2b — Sessions et historique des connexions

| | |
|---|---|
| **Session** | `h2b` |
| **Recette de référence** | [`SPRINT-H2B-RECETTE.md`](../../SPRINT-H2B-RECETTE.md) |
| **Étiquette** | `h2b-validated` |
| **Contexte** | Branche `sprint/h2b-sessions-et-historique` · 2026-10-22 · décisions du cadrage H2 : **CAD-H2-1 A** (historique lu dans le journal d'audit), **CAD-H2-2 A** (visible par l'intéressé seulement), **CAD-H2-3 B** (deux lots : H2a livré et validé, H2b = ce lot). Écrans S01 à S03. |
| **Écrans concernés** | [Sessions et connexions](../interfaces/07-sessions-et-connexions.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi. Elle sert à rejouer la recette utilisateur et à vérifier l'absence de régression.*

## Avant de commencer
- Pile locale lancée (`node scripts/local-stack.mjs --demo`) ou pile jetable ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : chargé de compte, Responsable commercial (avec son équipe), Direction, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | `GET /auth/sessions/history` | Mes connexions réussies et échouées sur **90 jours**, du plus récent au plus ancien, pagination par curseur (`limit` ≤ 100, `before`) — Identité tirée **du jeton seulement** : aucun identifiant d'utilisateur n'est accepté (`?userId=` → 400) ; permission `iam.session.read` ; `Cache-Control: no-store` ; aucune table nouvelle (lecture du journal d'audit en ajout seul) | ☐ | |
| 2 | `POST /auth/sessions/revoke-others` | Déconnecte **tous mes autres appareils**, la session courante reste ouverte — **MFA récent exigé** (step-up) ; cible = l'appelant, jamais lue dans la requête ; jetons de rafraîchissement révoqués ; action **auditée** (`SESSION_REVOKE`, `other_sessions_revoked`, nombre) | ☐ | |

## Preuves automatisées relevées à la validation
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

## Réserves, limites et dette connues
- **Adresse IP** : c'est celle que le serveur voit. En production, derrière un proxy, elle n'est exacte que si `TRUST_PROXY` est configuré correctement (dette D40, à vérifier en S7).
- **Avis juridique** sur la conservation et l'affichage des adresses IP et appareils : **toujours à obtenir** (Étape 0). La fenêtre de 90 jours et la visibilité réservée à l'intéressé sont les mesures de minimisation retenues en attendant.
- Pas de vue administrateur de l'historique (décision CAD-H2-2 A) ; extensible sans migration si la direction produit le décide.
- Nombre de codes de secours restants (D39) : non traité, en attente de votre décision.
- L'écoute avec un vrai lecteur d'écran (D31) doit couvrir : les six cases du code, les tableaux de sessions et d'historique, les fenêtres de confirmation.

## Rejouer les contrôles automatisés
```bash
pnpm ci                                   # types, architecture, tests unitaires et interface
node apps/api/scripts/test-db.mjs     # tests d'intégration (base PostgreSQL jetable)
```

*Pas de script de mutants versionné pour ce lot.*

## Écarts constatés
| Date | Vérification n° | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
