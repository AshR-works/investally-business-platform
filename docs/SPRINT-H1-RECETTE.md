# H1 — Habillage minimal et hub : recette

*Branche `sprint/h1-habillage-hub` · 2026-10-21 · décisions : CAD-H1-1 à 4 (toutes « A », voir [cadrages/CADRAGE-H1-HABILLAGE-ET-HUB.md](cadrages/CADRAGE-H1-HABILLAGE-ET-HUB.md)).*

## Ce qui est livré
| Élément | Détail |
|---|---|
| **Tailwind CSS v4** (CAD-H1-1) | `tailwindcss` et `@tailwindcss/postcss` **4.3.3 épinglées** ; thème déclaré dans le CSS (`app/theme.css`) ; **essai isolé réussi** (build Next.js 16, aucune erreur) : le repli sur le CSS structuré n'a pas été nécessaire |
| **Jetons du design** | `app/tokens.css` = copie du design validé v0.4.1 ; **un test échoue si les valeurs divergent** de `docs/design/prototype/tokens.css` |
| **Polices et logos hébergés** | Inter et Montserrat (OFL) dans `app/fonts`, logos dans `public/brand` ; aucune ressource externe (CSP inchangée) |
| **Coque** (EXD-01, 10, 11) | Panneau principal arrondi **centré sur la fenêtre**, navigation à gauche, repli automatique sur fenêtre étroite ; rail compact hors hub ; bouton-pictogramme de dépliage (préférence mémorisée) ; tiroir mobile ; lien « Aller au contenu » |
| **Hub** (EXD-05, CAD-H1-3) | Page `/` : recherche globale, **modules disponibles** selon les droits, **modules « À venir »** inactifs ; **aucune donnée fictive** ; la liste des entreprises passe en `/companies` |
| **Recherche globale** (CAD-H1-4) | Entreprises et utilisateurs, requêtes parallèles (droits appliqués par le serveur), seuil de 2 caractères, délai de frappe, requêtes abandonnées ; Ctrl/⌘ K depuis n'importe quelle page |
| **Thème clair / sombre** | Suit l'appareil, bascule mémorisée (tolère un stockage indisponible) |
| **Écrans existants** | Connexion, MFA, invitation, mot de passe, Entreprises, Utilisateurs, Mon compte : mêmes écrans, **jetons du design** appliqués via une couche `legacy` (dette D32), aucune logique modifiée |

**API non modifiée** : aucune règle de sécurité ni logique métier changée.

## Preuves
| Contrôle | Résultat |
|---|---|
| Typage | sans erreur |
| Tests de l'interface | **35 / 35** (24 existants + 11 nouveaux : jetons identiques à la source, catalogue des modules et droits, recherche : seuil, droits, regroupement, échec isolé, abandon ; thème) |
| Mutants | 2 / 2 tués (droit de lecture des utilisateurs retiré de la recherche ; jeton de couleur modifié) |
| Audit d'accessibilité (axe-core, 21 états au total dont 7 de la nouvelle coque) | **0 violation, 0 point à vérifier** dont hub, recherche avec résultats, **thème sombre**, **mobile tiroir fermé et ouvert**, rail compact, navigation dépliée |
| Politique de contenu (CSP) | **0 violation** pendant tout le parcours ; polices Inter et Montserrat chargées depuis l'application |
| Panneau centré (navigateur réel) | 2 200 px : marges **373 / 373 px**, largeur 1 440 px ; 1 280 px : repli (marge gauche = rail), aucun chevauchement, aucun défilement horizontal |
| Navigation mobile | Tiroir fermé : navigation **masquée** aux lecteurs d'écran (29 éléments lus) ; ouvert : 37 |
| Captures | Hub clair / sombre / recherche / mobile / menu mobile, Entreprises (rail, déplié, 2 200 px) : `docs/accessibilite/` (résultats) et dossier de session |

Détail état par état : [accessibilite/resultats/lecteur-d-ecran-proxy-2026-10-21.md](accessibilite/resultats/lecteur-d-ecran-proxy-2026-10-21.md).

## Écarts assumés avec le prototype
- Le hub **n'affiche ni indicateurs ni rendez-vous** : ils n'ont pas de source réelle (règle « aucune donnée fictive »).
- Le menu ne liste que ce qui est livré (3 modules + hub + Mon compte) ; les autres modules sont présentés sur le hub en « À venir ».
- Le bouton de dépliage est masqué sur le hub (navigation toujours complète) : à confirmer (DDR-0007, point 2).

## Dette ouverte (voir `TECH-DEBT.md`)
D32 styles legacy · D33 thème appliqué après le premier rendu · D34 recherche côté interface · D35 logos PNG et variante sombre · D36 pictogramme et bouton sur le hub · D31 écoute avec un vrai lecteur d'écran (toujours à faire).

## À valider par la direction produit
1. Le rendu (ouvrir la pile de test ou consulter les captures) : coque, hub, recherche, thème sombre, mobile.
2. Les écarts ci-dessus, en particulier **les indicateurs absents du hub** et **le bouton masqué sur le hub**.
3. « Je valide H1 » → fusion `--no-ff` dans `main` et étiquette `h1-validated`.

## Rejouer la recette
```
node apps/crm-api/scripts/test-db.mjs --keep      # base jetable
pnpm --filter @investally/crm-web build           # puis démarrer l'API et le web (voir SPRINT-3.4-RECETTE.md)
node scripts/a11y-audit.mjs --api-log <journal de l'API> --shots <dossier de captures>
```
