# Cadrage de la session H1 — Habillage minimal et hub

**Date** : 2026-10-21 · **Statut** : à décider · **Prochaine étape** après validation de ce cadrage : ouverture de la branche `sprint/h1-habillage-hub`.

> Méthode : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md). **Aucune décision n'est prise dans ce document** : les recommandations sont des avis, la décision est celle de la direction produit.

## 1. Objet et périmètre

**H1 — Habillage minimal et hub** est la prochaine session (DEC-005 : Étape 0 → **H1** → H2 → S3.6 → cadrage UX → S4…). Elle installe le **système de design validé (v0.4.1)** dans l'application réelle : jetons, polices et logos hébergés, coque (rail de navigation, barre supérieure, panneau principal centré), thème clair/sombre, hub, bouton de dépliage en pictogramme.

**Hors périmètre de H1** : écrans d'authentification (H2), documents (S3.6), écrans métier (S4+), modules Stocks et Reporting, tout changement de règle de sécurité ou de logique métier.

## 2. Ce qui existe déjà (état vérifié)

| Élément | État |
|---|---|
| Design validé | v0.4.1 dans `main` : prototype, jetons, spécification frontend, 26 captures |
| Front | Next.js 16, React 19, une feuille `globals.css` (107 lignes), pas de Tailwind, pas d'icônes ni de polices hébergées |
| Écrans réels | Connexion, MFA, invitation, mot de passe oublié, réinitialisation, Entreprises, Utilisateurs, Mon compte |
| Droits dans l'interface | Profil `/auth/me/profile` ; menus conditionnés par les droits |
| Accessibilité | Audit rejouable (`scripts/a11y-audit.mjs`) : 15 états à 0 violation ; titres de page ; fenêtres modales inertes |
| Listes avec recherche | Entreprises et Utilisateurs (paramètre `search`) |

## 3. Exigences appliquées (rappel)
EXD-01 (panneau), EXD-02 (sélection persistante), EXD-03 (pas de pastille Investudy, logo seulement dans la Formation), EXD-04 (Opportunités, cartes par 6 — écran S4.3), EXD-05 (hub), EXD-10 (panneau centré), EXD-11 (pictogramme de dépliage). Le document de design est mis à jour à chaque évolution.

## 4. Décisions à prendre avant de coder

| N° | Question | Options | Ma recommandation |
|---|---|---|---|
| CAD-H1-1 | Technique de style | A Tailwind v4 · B CSS structuré · C statu quo | **A** (avec essai isolé) |
| CAD-H1-2 | Périmètre | A coque+hub · B + 3 écrans connectés · C tout | **A** |
| CAD-H1-3 | Contenu du hub | A actifs + « à venir » · B actifs seulement · C statu quo | **A** (sans donnée fictive) |
| CAD-H1-4 | Recherche globale | A côté interface · B route dédiée · C différer | **A** |

Les fiches complètes suivent (gabarit de la méthode d'arbitrage).

---

### CAD-H1-1 — Technique de style de l'interface

**Contexte.** Le front n'a aucun framework de style : une seule feuille `globals.css` de 107 lignes. Le design v0.4.1 (validé) fournit des jetons CSS (`tokens.css`) et une correspondance Tailwind v4 (`tailwind-theme.css`). Il faut choisir comment le style entre dans l'application.

**Déjà décidé, ne bouge pas.** Jetons du design (clair et sombre), polices et logos hébergés (CSP `default-src 'self'`), aucune ressource externe, aucune logique de sécurité dans les composants (l'API décide).

**Options.**

**A. Tailwind CSS v4 piloté par les jetons** — Installation de Tailwind, configuration par le CSS (`@theme`) vers les variables du design, classes utilitaires dans les composants (plan et spécification actuels).

| | |
|---|---|
| Avantages | Conforme à la spécification validée ; thème sombre par changement de variables ; très répandu, composants rapides à écrire ; fichiers de style qui ne grossissent pas. |
| Inconvénients | Nouvelle dépendance de build ; versions très récentes (Tailwind v4 avec Next.js 16) ; classes longues dans le code. |
| Impact UX | Rendu identique au prototype, cohérence garantie par les jetons. |
| Impact métier | Aucun. |
| Impact technique | Ajout de Tailwind et de son plugin PostCSS ; essai isolé avant migration ; versions épinglées. |
| Impact maintenance | Une convention unique ; mises à jour de versions à suivre. |
| Coût et délai | ≈ 1 session (avec H1) |
| Réversibilité | Moyenne : les classes sont dans tous les composants ; revenir en arrière = réécrire le style. |

**B. CSS classique structuré (jetons + feuilles par composant)** — On garde `tokens.css` comme source des couleurs, et on écrit des feuilles CSS par composant (modules CSS de Next.js), sans Tailwind.

| | |
|---|---|
| Avantages | Aucune dépendance de plus ; jetons identiques ; transparence totale du CSS produit. |
| Inconvénients | Écart avec la spécification validée ; plus de CSS à écrire et à relire ; risque de dérive entre écrans sans classes partagées. |
| Impact UX | Identique si la discipline est tenue. |
| Impact métier | Aucun. |
| Impact technique | Feuilles par composant ; pas de nouvelle dépendance. |
| Impact maintenance | Plus de fichiers de style à tenir cohérents. |
| Coût et délai | ≈ 1 à 1,3 session |
| Réversibilité | Bonne : migration vers Tailwind possible composant par composant. |

**C. Statu quo : étendre `globals.css`** — On ajoute les jetons et les règles dans l'unique feuille existante.

| | |
|---|---|
| Avantages | Zéro nouveauté ; rapide au début. |
| Inconvénients | La feuille devient ingérable dès les premiers écrans métier ; contraire à la spécification ; thème sombre et responsive coûteux. |
| Impact UX | Risque d'incohérences visuelles. |
| Impact métier | Aucun. |
| Impact technique | Aucune. |
| Impact maintenance | Dette qui croît à chaque écran. |
| Coût et délai | < 1 session |
| Réversibilité | Facile à abandonner, mais la dette s'accumule. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 4 | 2 |
| Risque (favorable = faible) (5) | 3 | 4 | 3 |
| Cohérence architecture / décisions (4) | 5 | 3 | 1 |
| Réversibilité (4) | 3 | 4 | 3 |
| Coût et délai (favorable = faible) (3) | 3 | 3 | 5 |
| **Total sur 5** | **3,62** | **3,67** | **2,67** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Tailwind v4 / Next.js 16 : incompatibilité ou bogue | Moyenne | Moyen | Essai isolé sur une page avant migration ; versions épinglées ; repli possible sur l'option B (jetons conservés) |
| Dérive visuelle entre écrans | Moyenne | Moyen | Page de référence des composants + captures de référence comparées à chaque changement |

**Dette induite.** A : dépendances à tenir à jour. B : discipline de nommage à maintenir. C : dette croissante.

**Recommandation.** **A et B sont à égalité dans la grille (3,62 contre 3,67) : l'écart n'est pas significatif.** Je recommande tout de même **A**, pour deux raisons que la grille ne capte pas : la spécification de design validée la prévoit, et le volume d'écrans à venir (une trentaine) rend les classes utilitaires plus économiques que des feuilles par composant. **Condition** : essai isolé réussi, sinon bascule sur B sans perdre les jetons. Ferait changer d'avis : un blocage de compatibilité Tailwind v4 / Next.js 16, ou votre préférence pour zéro dépendance de plus.

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-H1-2 — Périmètre de H1 (ce qui est restylé dans cette session)

**Contexte.** DEC-005 prévoit un « H1 minimal » (coque et hub), puis H2 (authentification), puis chaque écran métier « né dans le nouveau style » (pas de H3 séparé). Il existe aujourd'hui trois écrans connectés (Entreprises, Utilisateurs, Mon compte) et six écrans d'accès.

**Déjà décidé, ne bouge pas.** Ordre Alternatif 1 (DEC-005) ; navigation B+ (DEC-002) ; panneau centré (DEC-007) ; bouton de dépliage en pictogramme (EXD-11).

**Options.**

**A. Coque et hub seulement (plan DEC-005)** — Jetons, polices, logos, coque (rail, barre supérieure, panneau centré), hub, thème clair/sombre. Les écrans existants s'affichent dans la nouvelle coque, avec leur ancien contenu.

| | |
|---|---|
| Avantages | Session courte ; risque faible ; fidèle à DEC-005 ; la valeur visible arrive vite. |
| Inconvénients | Cohabitation temporaire de la nouvelle coque et d'anciens contenus (rendu « mi-neuf »). |
| Impact UX | Coque neuve, contenus hétérogènes jusqu'à H2 et S4. |
| Impact métier | Aucun. |
| Impact technique | Coque et jetons ; compatibilité des anciens écrans à vérifier. |
| Impact maintenance | Un seul chantier à la fois. |
| Coût et délai | ≈ 1 session |
| Réversibilité | Excellente. |

**B. Coque, hub et les trois écrans connectés existants** — En plus : Entreprises, Utilisateurs et Mon compte sont restylés (ce que la spécification appelait H3).

| | |
|---|---|
| Avantages | Application cohérente pour les écrans connectés dès la fin de H1. |
| Inconvénients | Écarte DEC-005 (« pas de H3 séparé ») ; Entreprises sera refaite en S4.1 : travail en partie perdu. |
| Impact UX | Cohérence immédiate des écrans connectés. |
| Impact métier | Aucun. |
| Impact technique | Davantage de composants à écrire (tableaux, formulaires, fenêtres). |
| Impact maintenance | Composants communs utiles ensuite. |
| Coût et délai | ≈ 1,6 session |
| Réversibilité | Bonne. |

**C. Tout : coque, hub, écrans connectés et écrans d'accès** — H1 et H2 fusionnés, sans l'endpoint d'historique.

| | |
|---|---|
| Avantages | Application entièrement dans le nouveau style. |
| Inconvénients | Grosse session, recette large, risque de régression sur les écrans de sécurité (MFA, réinitialisation). |
| Impact UX | Cohérence totale. |
| Impact métier | Aucun. |
| Impact technique | Touche les parcours de sécurité. |
| Impact maintenance | Un seul gros lot. |
| Coût et délai | ≈ 2,5 sessions |
| Réversibilité | Moyenne. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 4 |
| Risque (favorable = faible) (5) | 4 | 3 | 2 |
| Cohérence architecture / décisions (4) | 5 | 3 | 2 |
| Réversibilité (4) | 5 | 4 | 3 |
| Coût et délai (favorable = faible) (3) | 5 | 3 | 1 |
| **Total sur 5** | **4,29** | **3,43** | **2,52** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Rendu « mi-neuf » mal perçu | Moyenne | Faible | Communiquer l'état ; les écrans suivent en H2 et S4 |
| Régression visuelle ou fonctionnelle des écrans existants | Moyenne | Moyen | Recette des 8 écrans rejouée, axe-core relancé (`scripts/a11y-audit.mjs`), 24 tests web |

**Dette induite.** A : cohabitation temporaire (à tracer). B : composants d'Entreprises à refaire en S4.1. C : lot trop gros.

**Recommandation.** Option **A**, conforme à votre décision DEC-005 et au principe « ne pas dépenser sur des écrans qui seront refaits ». Ferait changer d'avis : si la démonstration à des tiers avant H2 exige des écrans connectés cohérents (alors B).

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-H1-3 — Contenu réel du hub (Vue d'ensemble)

**Contexte.** Dans le prototype, le hub montre des tuiles de modules, des indicateurs et la recherche, avec des **données fictives**. Dans l'application, seuls existent : Entreprises, Utilisateurs (administration) et Mon compte. Les autres modules (Opportunités, Formation, Finance, Stocks, Reporting…) n'existent pas encore.

**Déjà décidé, ne bouge pas.** Le hub est le point d'entrée et la seule page à navigation complète (DEC-002, EXD-05). **Aucune donnée fictive ne doit sortir du prototype** (spécification §8) ; les menus restent conditionnés par les droits du profil et re-contrôlés par le serveur.

**Options.**

**A. Modules disponibles actifs, modules à venir visibles mais inactifs** — Tuiles actives pour ce qui existe (selon les droits) ; les modules futurs apparaissent grisés avec la mention « À venir », sans lien.

| | |
|---|---|
| Avantages | Montre la trajectoire du produit ; la navigation complète est déjà en place ; aucun lien mort. |
| Inconvénients | Éléments inactifs à l'écran (risque de frustration) ; liste de modules à maintenir. |
| Impact UX | Vue d'ensemble lisible et honnête. |
| Impact métier | Donne de la visibilité aux utilisateurs sur la feuille de route. |
| Impact technique | Liste des modules avec drapeau « disponible », filtrée par droits. |
| Impact maintenance | Mettre à jour le drapeau à chaque module livré. |
| Coût et délai | ≈ 0,3 session |
| Réversibilité | Excellente. |

**B. Uniquement les modules disponibles** — Le hub n'affiche que ce qui fonctionne et que l'utilisateur a le droit d'ouvrir.

| | |
|---|---|
| Avantages | Aucun élément inactif ; plus simple ; aucune promesse. |
| Inconvénients | Hub très pauvre au début (2 à 3 tuiles) ; la vision d'ensemble disparaît. |
| Impact UX | Sobre, un peu vide. |
| Impact métier | Aucun. |
| Impact technique | Liste filtrée par droits. |
| Impact maintenance | Ajouter une tuile à chaque module. |
| Coût et délai | ≈ 0,2 session |
| Réversibilité | Excellente. |

**C. Statu quo : pas de hub, la page d'accueil reste la liste des entreprises** — On ne construit pas le hub en H1.

| | |
|---|---|
| Avantages | Rien à faire. |
| Inconvénients | Contredit EXD-05 et DEC-002 ; pas de point d'entrée de navigation complète. |
| Impact UX | Navigation incomplète. |
| Impact métier | Aucun. |
| Impact technique | Aucune. |
| Impact maintenance | Aucune. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 4 | 3 | 1 |
| Risque (favorable = faible) (5) | 4 | 5 | 4 |
| Cohérence architecture / décisions (4) | 5 | 4 | 1 |
| Réversibilité (4) | 5 | 5 | 5 |
| Coût et délai (favorable = faible) (3) | 4 | 5 | 5 |
| **Total sur 5** | **4,38** | **4,33** | **3,05** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Données fictives affichées par erreur | Faible | Moyen | Aucun indicateur chiffré tant qu'il n'existe pas de source réelle ; revue des captures |
| Fuite d'existence de modules non autorisés | Faible | Faible | Tuiles filtrées par droits, le serveur re-contrôle toujours |

**Dette induite.** A : drapeaux de disponibilité à tenir à jour à chaque livraison de module.

**Recommandation.** Option **A**. Elle respecte vos exigences (hub = navigation complète) sans donnée fictive. **Sous-décision à votre main** : les indicateurs du prototype (chiffres, rendez-vous du jour) ne sont **pas** affichés tant que leur source n'existe pas.

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

### CAD-H1-4 — Recherche globale du hub

**Contexte.** EXD-05 demande une recherche globale (entreprises, contacts, offres, formations, sessions, utilisateurs, documents, rapports) respectant les droits. Aujourd'hui, seules deux listes existent : entreprises et utilisateurs, et **toutes deux acceptent déjà un paramètre `search`** et appliquent les droits côté serveur.

**Déjà décidé, ne bouge pas.** La recherche ne doit jamais montrer un objet que l'utilisateur n'a pas le droit de voir (le serveur décide, objet hors portée = introuvable).

**Options.**

**A. Recherche côté interface sur les listes existantes** — Le hub interroge en parallèle les listes entreprises et utilisateurs (selon les droits du profil) et regroupe les résultats par type.

| | |
|---|---|
| Avantages | Aucune nouvelle route ; droits hérités des routes existantes ; livrable dans H1. |
| Inconvénients | Une requête par type (2 aujourd'hui, 8 à terme) ; logique de regroupement côté client ; à remplacer par un vrai service plus tard. |
| Impact UX | Résultats groupés, ⌘K ; un peu plus lent avec beaucoup de types. |
| Impact métier | Couvre les deux seuls types qui existent. |
| Impact technique | Appels parallèles, annulation des requêtes périmées, limitation du débit côté interface. |
| Impact maintenance | Code jetable à remplacer. |
| Coût et délai | ≈ 0,3 session |
| Réversibilité | Excellente. |

**B. Route de recherche dédiée côté API** — Nouvelle route protégée qui interroge chaque module autorisé et renvoie des résultats groupés.

| | |
|---|---|
| Avantages | Conception définitive ; une seule requête ; audit et limitation centralisés. |
| Inconvénients | Nouvelle surface d'attaque et nouveau contrat à tenir ; ne sert pas encore (2 types seulement) ; risque de fuite entre types si mal conçue. |
| Impact UX | Meilleure à terme. |
| Impact métier | Aucun avant S4. |
| Impact technique | Nouveau module transverse, tests de droits par type et par rôle. |
| Impact maintenance | Un contrat à faire évoluer avec chaque module. |
| Coût et délai | ≈ 1 session |
| Réversibilité | Moyenne. |

**C. Différer la recherche globale (champ absent du hub en H1)** — Le hub est livré sans recherche ; elle arrive avec S4.1 (contacts) ou plus tard.

| | |
|---|---|
| Avantages | H1 plus court ; aucun code à jeter. |
| Inconvénients | Fonction centrale d'EXD-05 absente du premier hub. |
| Impact UX | Hub moins utile. |
| Impact métier | Aucun. |
| Impact technique | Aucune. |
| Impact maintenance | Aucune. |
| Coût et délai | 0 |
| Réversibilité | Excellente. |

**Grille** (notes de 1 à 5, 5 = favorable ; poids fixés avant notation ; totaux calculés).

| Critère (poids) | A | B | C |
|---|---|---|---|
| Valeur métier (5) | 3 | 4 | 1 |
| Risque (favorable = faible) (5) | 4 | 3 | 5 |
| Cohérence architecture / décisions (4) | 3 | 4 | 2 |
| Réversibilité (4) | 5 | 3 | 5 |
| Coût et délai (favorable = faible) (3) | 4 | 2 | 5 |
| **Total sur 5** | **3,76** | **3,29** | **3,48** |

**Risques.**

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Fuite d'informations entre types (option B) | Faible | Élevé | Tests de droits par rôle et par type (comme la matrice RBAC) avant mise en ligne |
| Surcharge par requêtes parallèles (option A) | Faible | Faible | Seuil minimal de caractères, délai de frappe, limitation du débit |

**Dette induite.** A : code d'agrégation à remplacer. B : contrat de recherche à maintenir. C : fonction attendue manquante.

**Recommandation.** Option **A** : elle livre la fonction demandée pour les types existants sans ajouter de surface d'attaque, (la note de C est abaissée en valeur et en cohérence car C ne satisfait pas EXD-05, exigence obligatoire ; sans cette réserve, C passerait devant) et prépare B quand 4 types ou plus existeront (S4.1 à S5). Ferait changer d'avis : un besoin de recherche transversale au texte intégral.

**Décision (direction produit).** ☐ À renseigner : option retenue · date · motif · réserves.

**Trace.** À enregistrer dans `docs/QUESTIONS-ET-DECISIONS.md` (et, pour le design, dans `docs/design/decisions/`).

---

## 5. Plan de réalisation proposé (si les recommandations sont retenues)

1. **Essai isolé** : Tailwind v4 + jetons sur une page de référence (composants, clair et sombre). Point d'arrêt si incompatibilité.
2. **Fondations** : jetons, polices et logos hébergés, thème (suit l'appareil + bascule mémorisée).
3. **Coque** : rail compact / navigation complète, panneau centré (option B de DEC-007), bouton pictogramme, barre supérieure, menus selon les droits.
4. **Hub** : tuiles des modules disponibles, modules « à venir » inactifs, recherche globale sur entreprises et utilisateurs, ⌘K.
5. **Compatibilité** des écrans existants dans la nouvelle coque.
6. **Preuves** : tests web, typage, axe-core (`scripts/a11y-audit.mjs`), captures comparées au prototype, parcours rejoués dans un navigateur réel, vérification CSP.
7. **Documents** : recette `SPRINT-H1-RECETTE.md`, index des fonctions, **mise à jour du document de design** (version, journal, captures).

## 6. Prérequis et risques de la session

| Prérequis / risque | Statut |
|---|---|
| Logos : fichiers fournis (PNG) ; SVG officiels attendus avant mise en ligne | Dette connue |
| Écoute avec un vrai lecteur d'écran (dette D31) | À faire par une personne, idéalement avant H2 |
| Largeur 901–1 100 px : défilement horizontal préexistant avec navigation dépliée | À traiter dans H1 si le périmètre l'inclut (tableaux) |
| Aucun changement de règle de sécurité | Vérifié par les tests existants (API non touchée) |

## 7. Critères de réussite (recette)
- Parcours réels rejoués : connexion → MFA → hub → Entreprises → Utilisateurs → Mon compte, en clair et en sombre.
- 0 violation axe-core sur les états audités, focus visible, navigation au clavier du rail et du bouton de dépliage.
- Contrastes AA mesurés ; panneau centré à 2 200, 1 700 et 1 360 px.
- Aucune ressource externe (CSP intacte), aucune donnée fictive.
- Tests : 24 tests web minimum + nouveaux tests des composants clés.
