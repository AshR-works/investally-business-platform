# Journal des modifications du design

Format : une section par version, du plus récent au plus ancien. Chaque ligne renvoie à une exigence (EXD), une décision (DEC/DDR) ou une demande.

## 0.4.1 — 2026-10-21 — *Validée*
- **EXD-10 / DEC-007 / DDR-0007** : panneau principal **centré sur la fenêtre** (option B) ; repli automatique en centrage dans l'espace restant quand la fenêtre est étroite ; largeur du panneau 1 440 px au plus ; la largeur maximale du contenu (1 320 px) est supprimée.
- **EXD-11** : bouton de dépliage en **pictogramme seul** (44 px, nom accessible, info-bulle, état annoncé) ; pictogramme provisoire à confirmer.
- Constat consigné : défilement horizontal entre 901 et 1 100 px avec la navigation dépliée, antérieur à cette version.

## 0.4.0 — 2026-10-21 — *En revue*
**Décisions appliquées** (la direction produit a demandé d'appliquer les décisions recommandées) : DEC-001 à DEC-006.
- **Navigation B+** (DEC-002, DDR-0004, EXD-05) : le **hub** (Vue d'ensemble) affiche la navigation complète, la **recherche globale** (8 types, groupés, limités aux droits) et les **tuiles de modules** ; ailleurs, **rail compact** (icônes, info-bulles, bouton « Déplier » mémorisé) et lien « ← Vue d'ensemble » dans le fil d'Ariane ; tiroir sur mobile ; raccourci ⌘K.
- **Opportunités hybrides** (DEC-003, DDR-0005, EXD-04) : bandeau d'étapes cliquable (nombre et montant par étape), tri (prochaine action, montant, étape), cartes par lignes de 6, bascule « Par étape » ; **la sélection survit au tri et au filtre**.
- Menu : ajout de **Stocks** et **Reporting** (modules à venir, DEC-004, EXD-07/08) ; symbole Investally isolé pour le rail.
- **Gouvernance** (DEC-001, DDR-0006) : dossiers `releases/`, `decisions/`, `exigences/`, `outils/`, README, VERSION, ce journal ; versions 0.1.0 à 0.3.0 **reconstituées**.
- **Correctif** : initialisation de la navigation (accès avant initialisation détecté à la recette).

## 0.3.0 — 2026-10-21 — *Proposée (reconstituée)*
- **EXD-01** : zone principale en panneau sur fond global plus foncé (DDR-0003).
- **EXD-02** : sélection persistante des lignes et des cartes, barre d'actions (DDR-0003).
- **EXD-03** : pastille Investudy retirée de la barre latérale.
- **EXD-04** : « Développement » devient « Opportunités », cartes par lignes de 6.

## 0.2.0 — 2026-10-21 — *Proposée (reconstituée)*
- **Espace agenda** : vues semaine et mois, filtres par type, mini-calendrier, fenêtre « Nouvel événement ».
- Captures de **tous les écrans en thème sombre**.
- Correctifs : mise en évidence du jour courant, hauteur de deux événements.

## 0.1.0 — 2026-10-21 — *Proposée (reconstituée)*
- Direction artistique, design system, prototype de 7 écrans (clair et sombre), jetons, polices hébergées.
- Logos fournis (Investally rectangle et carré, Investudy rectangle) (DDR-0002).
- Contrastes WCAG mesurés ; bordures de champs corrigées (DDR-0001).
