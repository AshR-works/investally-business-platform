# Registre des exigences de conception (EXD)

> Mis à jour le 2026-10-21 après **application des décisions recommandées** (DEC-001 à DEC-006) : voir [../05-AIDE-A-LA-DECISION.md](../05-AIDE-A-LA-DECISION.md) et [../decisions/REGISTRE-DDR.md](../decisions/REGISTRE-DDR.md).

**Statut** : exigences **obligatoires**, enregistrées le 2026-10-21 à la demande de la direction produit.
**Priorité** : elles **priment sur toutes les versions précédentes** du design (document 01, prototype, captures). En cas de contradiction, c'est l'exigence EXD qui s'applique.
**Règle de conduite** : aucune refonte complète. Les exigences s'appliquent **par touches ciblées** ; les écrans nouveaux sont créés dans les prochaines itérations (voir [04-ANALYSE-D-IMPACT.md](../04-ANALYSE-D-IMPACT.md)).

Légende : ✅ appliqué au prototype · 🟡 appliqué en partie · 📐 spécifié, à construire à la prochaine itération · ❓ interprétation à confirmer avant de construire.

| Réf. | Exigence | Statut | Où c'est appliqué ou prévu |
|---|---|---|---|
| **EXD-01** | **Profondeur visuelle** : la zone principale se distingue nettement du fond global, sans ombres fortes, en gardant l'allure premium | ✅ | Fond global plus foncé (`--canvas`), zone principale en **panneau** arrondi avec bordure et ombre légère (`--shadow-panel`), clair et sombre |
| **EXD-02** | **Sélection persistante** : toute ligne ou carte sélectionnée reste visuellement active jusqu'à désélection ; l'état actif se reconnaît immédiatement ; valable pour tableaux, listes et éléments sélectionnables | ✅ | Lignes de tableaux : fond teinté + **barre latérale de 4 px** + case cochée ; cartes d'opportunités : contour renforcé + fond teinté ; **barre d'actions** « n sélectionnées » ; sélection au clic **ou** à la case ; « Tout désélectionner » |
| **EXD-03** | **Sidebar** : supprimer la pastille Investudy | ✅ | Retirée. Le menu « Formation » reste ; le **logo Investudy reste uniquement dans l'en-tête de l'écran Formation** (demande précédente) |
| **EXD-04** | **Module Opportunités** : renommer « Développement » en « Opportunités » ; cartes **par lignes de 6**, groupes empilés verticalement | ✅ | Menu, titre, fil d'Ariane ; grille de cartes (6 par ligne dès 1 360 px de large, 4 / 3 / 2 / 1 en dessous) ; bascule « Par étape » conserve la vue en colonnes ; l'étiquette de domaine devient « Business Development ». **Hybride décidé** (DEC-003, DDR-0005) : bandeau d'étapes cliquable, tri, sélection qui survit — appliqué en v0.4.0 |
| **EXD-05** | **Navigation globale** : la navigation complète n'apparaît que dans « Vue d'ensemble », qui devient le point d'entrée, le hub de navigation et le moteur de recherche global (entreprises, contacts, offres, formations, sessions, utilisateurs, documents, rapports) | ✅ | **Décidé : B+** (DEC-002, DDR-0004). Hub = navigation complète + recherche globale (8 types, groupés, droits respectés) + tuiles ; ailleurs rail compact + bouton « Déplier » mémorisé ; ⌘K. Appliqué au prototype v0.4.0 |
| **EXD-06** | **Parcours d'authentification complets**, visibles et navigables : connexion, MFA (saisie, activation, configuration, QR, codes de secours), réinitialisation (oubli, e-mail envoyé, nouveau mot de passe), sessions (actives, historique, révocation) | 📐 | 18 écrans listés dans l'analyse d'impact §4.1 |
| **EXD-07** | **Module Stocks** : articles, catégories, fournisseurs, entrées, sorties, inventaire, seuils d'alerte, historique, mouvements, consommations internes ; tableau de bord (stock total, ruptures, articles critiques, derniers mouvements) | 📐 | **Rattachement décidé : module autonome hébergé dans le monolithe du CRM, conçu pour être extrait** (DEC-004, ADR-0007). Entrée « Stocks » dans le menu (à venir) ; 11 écrans listés dans l'analyse d'impact §4.2, à construire en dernier (DEC-005) |
| **EXD-08** | **Module Reporting** : rapports journaliers, hebdomadaires, mensuels, trimestriels, annuels ; **gestion des incidents** (déclaration, suivi, résolution, attribution) ; **rapports des employés** (activités, comptes rendus, suivi des actions, remontée de problèmes, suivi des performances) | 📐 | 12 écrans (analyse d'impact §4.3), après S4 (**incidents d'abord**). **Contrainte décidée (DEC-006)** : le **suivi des performances** ne se construit **qu'après avis juridique et RH**, avec transparence pour l'employé. Entrée « Reporting » dans le menu (à venir) |
| **EXD-09** | **Cohérence métier** : toute modification reste cohérente avec Business Development, Training Management, Finance, RH, Fiscalité, Administration, Sécurité, Reporting | ✅ (principe) | Architecture des modules mise à jour : analyse d'impact §7 |
| **EXD-10** | **Panneau principal centré à tout moment** (demande du 2026-10-21) | ✅ | Option B (DEC-007, DDR-0007) : centré sur la fenêtre, panneau 1 440 px au plus, repli automatique en centrage dans l'espace restant sur fenêtre étroite. Mesuré à 2 200, 1 700 et 1 360 px ; **réalisé dans l'application (H1)** : marges 373 / 373 px à 2 200 px |
| **EXD-11** | **Bouton de dépliage = pictogramme de l'action, toujours actionnable** (demande du 2026-10-21) | 🟡 | **Réalisé dans l'application (H1)**. Pictogramme seul 44 px, nom accessible, état annoncé ; **pictogramme provisoire, à confirmer** ; reste masqué sur le hub (navigation complète) — à confirmer |

## Règles d'application
1. Une nouvelle maquette ou une nouvelle version **commence** par relire ce registre.
2. Toute exigence appliquée est consignée ici avec sa date et sa preuve (capture, écran).
3. Si une exigence entre en conflit avec l'accessibilité, la sécurité ou l'architecture, **je le signale avant d'appliquer** (c'est le cas d'EXD-05 et de la partie « suivi des performances » d'EXD-08).
4. Une exigence ne disparaît jamais : si elle change, une ligne « remplacée par » est ajoutée.

## Historique
| Date | Événement |
|---|---|
| 2026-10-21 | Enregistrement d'EXD-01 à EXD-09. EXD-01 à EXD-04 appliquées au prototype ; EXD-05 à EXD-08 spécifiées dans l'analyse d'impact |
| 2026-10-21 | Décisions recommandées appliquées (DEC-001 à 006) : EXD-05 ✅ (B+), EXD-04 hybride ✅, EXD-07 rattachement décidé, EXD-08 contrainte juridique actée ; prototype v0.4.0 |
| 2026-10-21 | EXD-10 et EXD-11 enregistrées. EXD-10 appliquée (option B, DEC-007) ; EXD-11 appliquée à titre provisoire (v0.4.1). **Règle permanente** : le document de design est mis à jour à chaque évolution |
| 2026-10-21 | **H1** : EXD-01, EXD-05, EXD-10 et EXD-11 réalisées dans l'application réelle (coque, hub, recherche globale, thème). EXD-11 reste à confirmer (pictogramme, hub) |
| 2026-10-21 | **H1b** : EXD-02 (sélection persistante) réalisée dans l'application sur les tableaux Entreprises et Utilisateurs ; EXD-04 (cartes d'opportunités) reste pour S4.3 ; écarts consignés dans `docs/cadrages/ECART-MOCKUP-VS-REEL.md` |
| 2026-10-22 | **H2a** : EXD-06 réalisée pour les écrans A01 à A15 (connexion, MFA, codes de secours, mot de passe oublié, réinitialisation, activation, états d'erreur et de limitation) ; sessions et historique (S01 à S03) restent pour H2b |
| 2026-10-22 | **H2b** : EXD-06 **complète** (A01 à A15 et S01 à S03 réalisés dans l'application) |
