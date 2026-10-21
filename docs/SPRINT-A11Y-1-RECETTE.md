# Accessibilité 1 — vérification « lecteurs d'écran » : recette

*Branche `sprint/a11y-1-lecteurs-d-ecran` · 2026-10-21 · demandé par le product owner après validation de S3.4 et S3.5.*

## Ce qui a été fait, et ce qui ne l'a pas été
| Fait | Pas fait (et pourquoi) |
|---|---|
| Audit **axe-core 4.10.2** (WCAG 2.0/2.1/2.2 A et AA + bonnes pratiques) de **15 états d'écran réels**, dans un navigateur réel (Edge sans fenêtre), sur une pile jetable | **Écoute avec NVDA / Narrator / VoiceOver** : je ne peux pas faire fonctionner un lecteur d'écran. Elle reste à faire par une personne : protocole prêt dans [`accessibilite/PROTOCOLE-LECTEUR-D-ECRAN.md`](accessibilite/PROTOCOLE-LECTEUR-D-ECRAN.md) |
| Extraction de l'**arbre d'accessibilité** (ce que le navigateur transmet aux lecteurs d'écran), dans l'ordre de lecture, pour chaque état | Appareils mobiles (VoiceOver iOS, TalkBack) |
| Contrôle du focus : entrée dans une fenêtre, Tab qui reste dedans, retour à l'élément d'origine après Échap | Prototype de design (branche `design/`) : à auditer au moment de son application |

Outil rejouable : `node scripts/a11y-audit.mjs --api-log <journal de l'API>` (résultats dans `docs/accessibilite/resultats/`).

## Défauts trouvés et corrigés
| # | Défaut | Gravité | Correction |
|---|---|---|---|
| 1 | **Même titre de page partout** (« Investally CRM ») : un utilisateur de lecteur d'écran ne sait pas sur quelle page il est ni quand elle change (WCAG 2.4.2). *Non détecté par l'outil automatique.* | Majeure | Composant `PageHeading` : le `h1` fixe aussi le titre du document, rétabli si Next.js le remplace après une navigation interne. Titres distincts pour les liens invalides (invitation / réinitialisation) |
| 2 | **Fond non inerte derrière les fenêtres** : le commentaire du code l'annonçait, mais seul `aria-modal` y contribuait (non respecté par tous les lecteurs) ; Tab pouvait sortir de la fenêtre. *Non détecté par l'outil automatique.* | Majeure | `Modal` : le reste de la page reçoit `inert`, Tab boucle dans la fenêtre, le focus est rendu à l'élément d'origine. Vérifié : 61 éléments lisibles avant, 19 après (fenêtre ouverte) |
| 3 | Colonne d'actions de « Mon compte » sans nom (`th` vide) — détecté par axe | Mineure | Texte réservé « Actions » (`.sr-only`) |
| 4 | Groupe des codes de secours : `aria-label` sur un `div` sans rôle (interdit par ARIA) — signalé « à vérifier » par axe | Mineure | `role="group"` |

## Résultat final (après corrections)
- **15 états audités, 0 violation, 0 point à vérifier à la main.**
- Langue du document `fr` partout. Les erreurs (`role="alert"`) et confirmations (`role="status"`) sont annoncées sans déplacer le focus. Les champs obligatoires sont annoncés comme tels. Le QR code a une alternative texte et la clé manuelle est disponible.
- Tests de l'interface : 24/24 ; typage sans erreur. Détail état par état : [`accessibilite/resultats/lecteur-d-ecran-proxy-2026-10-21.md`](accessibilite/resultats/lecteur-d-ecran-proxy-2026-10-21.md).

## Reste à faire (dette D31)
1. Écoute humaine du protocole (NVDA + Firefox au minimum, Narrator, puis VoiceOver).
2. Brancher `a11y-audit.mjs` dans la CI quand une pile de test web sera disponible (aujourd'hui lancé à la main).
3. Auditer les écrans du nouveau design à leur intégration (rail de navigation, hub, cartes d'opportunités ; toute interaction au glisser-déposer devra avoir une alternative clavier).

## Microsoft 365 (ajourné par le product owner le 2026-10-21)
Abonnement non réglé : on poursuit avec l'adaptateur « journal » (aucun e-mail réel ; liens lus dans la console en développement). **La mise en production est bloquée** tant que l'accès M365 n'est pas fourni (la configuration de production exige `EMAIL_PROVIDER=microsoft365`). Aucune alternative (SMTP, autre service) n'est décidée : le sujet suivra la méthode d'arbitrage si le délai se prolonge.
