# Journal des modifications du design

Format : une section par version, du plus récent au plus ancien. Chaque ligne renvoie à une exigence (EXD), une décision (DEC/DDR) ou une demande.

## Implémentation dans l'application — session H1 (2026-10-21), sans changement de version
Le design 0.4.1 est installé dans l'application réelle (`apps/crm-web`) : jetons (copie contrôlée par test), polices et logos hébergés, Tailwind v4, coque (navigation complète sur le hub, rail compact ailleurs, panneau centré, bouton-pictogramme), hub réel, recherche globale, thème clair/sombre. **Écarts assumés avec le prototype** (CAD-H1-3) : le hub n'affiche **aucun chiffre ni donnée fictive** (les indicateurs reviendront avec leur source) ; les modules non livrés apparaissent « À venir » et inactifs ; la liste des entreprises passe de `/` à `/companies`. Preuves : `docs/SPRINT-H1-RECETTE.md`.

**H1b (même jour)** : composants de données du design dans l'application — en-tête de page, tableau avec sélection persistante (EXD-02), badges de statut, barre d'outils (filtres rapides, recherche), pagination, menu d'actions de ligne, cellule « entité » — appliqués à Entreprises, Utilisateurs et sessions de Mon compte, **avec les seules données réelles** (écarts : `docs/cadrages/ECART-MOCKUP-VS-REEL.md`). **Arbitrage D21** : Pays et « Créée le » ajoutés au tableau Entreprises ; responsable, filtres et compteurs viendront avec S4.1 après le cadrage UX.

**S3.6 (2026-10-22)** : première **fiche entreprise** (`/companies/{id}`, version minimale : identité et documents) et panneau **Documents** réutilisable (liste, envoi en fenêtre, nouvelle version, historique des versions avec empreinte SHA-256, téléchargement, archivage ; avertissement « non analysé » tant que l'antivirus n'existe pas). Le nom d'une entreprise dans la liste devient un lien vers sa fiche. **Écarts** : la fiche n'a ni contacts, ni offres, ni rendez-vous (S4.1).

**H2b (2026-10-22)** : sessions actives, historique des connexions et révocation (S01 à S03) réalisés dans une page « Sessions et connexions » (`/account/sessions`), sous-page de Mon compte ; **EXD-06 complète**. Niveau de risque des sessions affiché en texte et teinte ; confirmations en fenêtre modale ; historique visible par l'intéressé seulement.

**H2a (2026-10-22)** : les écrans d'accès A01 à A15 sont réalisés dans l'application au gabarit du prototype (carte d'accueil sombre, indicateur d'étape, notices, règles du mot de passe en direct, introduction du MFA en trois étapes, compte à rebours après trop de tentatives). Code à 6 chiffres en **six cases**, conforme au prototype (DDR-0009, qui remplace DDR-0008 sur demande de la direction produit) ; champ unique conservé pour les codes de secours. **Écart assumé** : nombre de codes de secours restants non affiché (l'API ne le fournit pas, dette D39).

**S3.7 (2026-10-22), sans changement de version** : trois composants réalisés dans l'application d'après les retours de tests locaux (DDR-0010) : champ mot de passe avec œil (`PasswordField`, EXD-12), fenêtre de confirmation `danger` (`ConfirmDialog`, EXD-13) et codes de secours à affichage unique (`SecretCodesPanel`, EXD-13). Deux icônes (`eye`, `eye-off`) et un pictogramme d'alerte ajoutés au jeu. **Prototype 0.4.1 non encore mis à jour** : ces composants seront ajoutés à la version 0.5.0 (nouveaux composants, MINEUR). Rôles et permissions (UX-02, option B+C) : lot distinct, à venir.

**S3.8 (2026-10-28), sans changement de version** : sélecteur de rôles par familles et aperçu des droits effectifs réalisés dans l'application d'après le retour de tests UX-02 (option B+C, DDR-0011, EXD-14) : composants `RolePicker` et `RightsPreview`, fenêtres larges (`Modal size="wide"`). **Prototype 0.4.1 non encore mis à jour** : ces composants seront ajoutés à la version 0.5.0 avec ceux de S3.7.

**S4.0 (2026-10-28), sans changement de version** : fiche de création d'entreprise complétée d'après la demande de la direction produit (coordonnées, mise en relation par un facilitateur, méthode de contact, commission) et bloc « Mise en relation » dans la fiche entreprise (DDR-0012). Composants `CreateCompanyDialog` et `FacilitationPanel`. Correction du 2026-10-29 : devise de la commission préremplie « XAF » (FCFA). **Prototype 0.4.1 non encore mis à jour** : à ajouter à la version 0.5.0.

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
