# Analyse d'impact des exigences EXD-01 à EXD-09

**Date** : 2026-10-21 · **Références** : [REGISTRE-EXD.md](exigences/REGISTRE-EXD.md), [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md)
**Principe** : aucune refonte. EXD-01 à EXD-04 sont appliquées au prototype ; EXD-05 à EXD-08 sont analysées et spécifiées ici, **à construire à la prochaine itération** après vos réponses (§9).

---

## 1. Analyse des impacts UX

### 1.1 EXD-01 — Profondeur de la zone principale
- **Bénéfice** : on distingue immédiatement « l'application » (panneau) de « l'environnement » (fond), ce qui structure la page sans ajouter d'éléments.
- **Réalisation** : fond global `#E6DFDA` (sombre `#0B0B0A`), panneau `#FAFAFC` (sombre `#171615`) avec bordure 1 px et ombre douce à deux couches. Le contraste fond / panneau est volontairement **mesuré** (≈ 1,2 : 1) pour rester premium.
- **Effet de bord** : le texte posé *directement sur le fond global* (menu latéral) doit être plus sombre : les étiquettes de section et le profil passent de `--muted` (3,9 : 1 sur ce fond, **insuffisant**) à `--ink-2` (5,2 : 1). Corrigé.

### 1.2 EXD-02 — Sélection persistante
- **Règle** : *sélectionné ≠ survolé ≠ actif de navigation*. Le survol est un fond léger temporaire ; la sélection est un fond teinté **et** une barre de 4 px **et** une case cochée (trois indices, jamais la couleur seule).
- **Comportement** : clic sur la ligne ou sur la case ; case d'en-tête = tout sélectionner ; une barre d'actions apparaît dès qu'une ligne est sélectionnée (« 2 sélectionnées · Exporter · Réassigner · Tout désélectionner »).
- **Accessibilité** : la **case à cocher** est le contrôle (nom accessible « Sélectionner <entreprise> ») ; le clic sur la ligne est un raccourci. Les cartes sont des boutons à bascule (`aria-pressed`).
- **À trancher** : la sélection survit-elle à la pagination et au changement de filtre ? *Proposition* : oui (compteur global), avec le bouton « Tout désélectionner ».

### 1.3 EXD-03 — Suppression de la pastille Investudy
- La navigation est recentrée sur la plateforme. Investudy n'existe plus que **dans le module Formation** (menu « Formation » et logo dans l'en-tête de son écran).

### 1.4 EXD-04 — Opportunités en cartes, 6 par ligne
- **Gain** : comparaison visuelle immédiate ; 18 opportunités visibles d'un coup sur un écran de bureau.
- **Perte compensée** : la vue par colonnes d'étapes (kanban) permettait de voir *où en est chaque opportunité dans le processus* ; elle est conservée en bascule « Par étape ». **Recommandation** : garder les deux, « Cartes » par défaut comme demandé.
- **Contrainte** : « 6 par ligne » suppose une largeur de contenu d'environ 1 000 px ; en dessous de 1 360 px de largeur d'écran, la grille passe à 4, 3, 2 puis 1 colonne (téléphone).
- **À définir** : ordre des cartes (par échéance ? par montant ? par étape ?) ; *proposition* : tri par prochaine action, configurable.

### 1.5 EXD-05 — Navigation complète uniquement dans « Vue d'ensemble » ❓
Cette exigence est la plus structurante. **Risques** si on supprime toute navigation ailleurs : retour systématique à l'accueil pour changer de module (3 clics au lieu de 1 pour un usage quotidien), perte d'orientation, aucune navigation mobile.
**Motif recommandé (« hub + rail compact + ⌘K »)** :
| Où | Navigation affichée |
|---|---|
| **Vue d'ensemble** | **Navigation complète** (sections, libellés, badges) + **barre de recherche globale en grand** + modules en grandes tuiles + « reprendre où j'en étais » |
| **Toutes les autres pages** | **Rail compact** (icônes seules, 72 px, info-bulle et `aria-label`) + fil d'Ariane avec **« ← Vue d'ensemble »** + sous-navigation propre au module (onglets) + **recherche globale ⌘K** toujours dans la barre supérieure |
Cela respecte l'esprit (la navigation *complète* est au hub) sans enfermer l'utilisateur. **Alternative stricte** (aucune navigation hors hub) : possible, mais je la déconseille (efficacité, accessibilité 2.4.5 « plusieurs moyens de navigation »).
**Recherche globale** : entreprises, contacts, offres, formations, sessions, utilisateurs, documents, rapports ; résultats **groupés par type**, limités aux droits de l'utilisateur (un résultat qu'on ne peut pas ouvrir n'apparaît pas) ; raccourcis clavier ; récents. *Impact backend* : un index de recherche par module et un point d'entrée `/search` qui interroge uniquement ce que l'appelant peut lire.

### 1.6 EXD-06 — Authentification et sessions
18 écrans (§4.1). **Enjeux UX** : messages **identiques** pour compte connu et inconnu (anti-énumération) ; QR et codes de secours affichés **une seule fois** ; reprise possible si l'utilisateur quitte l'enrôlement ; états d'erreur explicites (code périmé, compte verrouillé, limite de débit) sans rien révéler de sensible. **Historique des connexions** : aujourd'hui l'API conserve les tentatives et les événements d'audit mais **n'expose pas encore** un historique utilisateur : *impact backend* à prévoir (§7). La « localisation » d'une connexion n'est pas disponible (seulement IP et appareil) : on n'affichera pas de ville sans geo-IP (décision de confidentialité).

### 1.7 EXD-07 — Stocks
Parcours : *réceptionner* (entrée) → *consommer* (sortie interne) → *compter* (inventaire) → *alerter* (seuils). **Principes** : un mouvement est **immuable** (on corrige par un mouvement inverse, comme l'audit) ; le stock ne peut pas devenir négatif ; chaque sortie dit **qui, pour quel service, pourquoi**. Les alertes (rupture, article critique) alimentent l'agenda et le tableau de bord.

### 1.8 EXD-08 — Reporting, incidents, rapports des employés
- **Rapports périodiques** : à produire par rôle (journalier, hebdomadaire, mensuel, trimestriel, annuel), **préremplis** à partir des données du système (opportunités, relances, sessions, stocks, incidents) pour éviter la double saisie, avec une zone de commentaire libre. Un rapport a un cycle : *brouillon → soumis → validé*.
- **Incidents** : déclaré → attribué → en cours → résolu → clos ; chronologie des échanges ; pièces jointes (module Documents, S3.6).
- **Rapports des employés** : activités, comptes rendus, actions, problèmes remontés. ⚠ **« Suivi des performances »** : sensible (données personnelles de salariés). Recommandation : **transparence** (chaque employé voit ce qui est mesuré sur lui), finalités écrites, accès limité (l'employé, son responsable direct, la RH), pas de mesure cachée, **validation juridique et RH avant construction** (voir §9).

---

## 2. Analyse des impacts UI

| Domaine | Changement | État |
|---|---|---|
| Jetons | `--canvas`, `--shadow-panel`, `--selected-bg`, `--selected-bar` (clair et sombre) | ✅ |
| Coque | Fond global + panneau principal arrondi ; menu latéral transparent sur le fond ; topbar dans le panneau | ✅ |
| Tableaux | Ligne sélectionnée persistante, curseur « main », case d'en-tête, barre d'actions | ✅ |
| Cartes | Carte d'opportunité sélectionnable, 6 colonnes, titre sur 2 lignes maximum, montant en police d'affichage | ✅ |
| Menu | Pastille Investudy retirée ; « Opportunités » ; (prévu) rail compact | ✅ / 📐 |
| Nouveaux gabarits | Écran d'authentification pas à pas, formulaire de mouvement de stock, éditeur de rapport, fiche incident, résultats de recherche groupés | 📐 |
| Accessibilité | Contrastes recalculés pour le texte sur fond global ; sélection non portée par la couleur seule | ✅ |

**Contrastes mesurés (nouveaux jetons)** : encre sur fond global 13,4 : 1 · `--ink-2` sur fond global 5,2 : 1 · encre sur ligne sélectionnée 14,2 : 1 · barre de sélection `#7A6355` sur blanc 5,6 : 1.

---

## 3. Écrans à modifier

| Écran | Modification | Exigence |
|---|---|---|
| Tous (coque) | Fond global + panneau ; menu latéral sans pastille | EXD-01, 03 |
| Vue d'ensemble | **Devient le hub** : navigation complète, recherche globale en grand, tuiles de modules, « à reprendre » | EXD-05 |
| Entreprises | Sélection persistante, barre d'actions | EXD-02 |
| Opportunités (ex-Pipeline) | Cartes 6 par ligne, sélection, bascule « Par étape », nouveau nom | EXD-02, 04 |
| Sécurité (Centre de confiance) | Sélection persistante des événements ; lien vers « Sessions » | EXD-02, 06 |
| Formation | Sélection persistante ; logo Investudy conservé dans l'en-tête | EXD-02, 03 |
| Agenda | Ajout des échéances de stock et des rapports à rendre (types d'événements) | EXD-07, 08 |
| Utilisateurs, Mon compte *(application)* | Reprennent la sélection persistante ; « Mon compte » se structure en onglets Sécurité | EXD-02, 06 |
| Composants | Fiche mise à jour (sélection, cartes, panneau) | EXD-01, 02 |

## 4. Nouveaux écrans à créer

### 4.1 Authentification et sessions (EXD-06) — 18 écrans
| Réf. | Écran | Notes |
|---|---|---|
| A01 | Connexion | Existe ; ajouter états erreur, verrouillage, limite de débit |
| A02 | Saisie du code MFA | Code à 6 chiffres + lien « code de secours » |
| A03 | Utiliser un code de secours | Format `XXXXX-XXXXX`, nombre restant |
| A04 | Activation du MFA (introduction) | Pourquoi, 3 étapes, obligatoire pour tous |
| A05 | Configuration MFA — **QR code** et clé manuelle | QR généré dans le navigateur |
| A06 | Confirmation du premier code | Erreur « code invalide » |
| A07 | **Codes de secours** (affichage unique) | Copier, télécharger, case « conservés » obligatoire |
| A08 | Mot de passe oublié (saisie de l'adresse) | |
| A09 | **E-mail envoyé** (message identique pour toute adresse) | Rappel : 60 min, vérifier les indésirables |
| A10 | Réinitialisation du mot de passe | Règles visibles en direct, confirmation |
| A11 | Mot de passe modifié | « Toutes vos sessions ont été fermées » |
| A12 | Lien invalide ou expiré | Proposer un nouveau lien |
| A13 | Activation d'invitation | Choix du mot de passe |
| A14 | Compte verrouillé (message générique) | Sans détail exploitable |
| A15 | Trop de tentatives (limite atteinte) | Délai d'attente |
| S01 | **Sessions actives** | Appareil lisible, IP, risque, « cette session », bouton Révoquer |
| S02 | **Historique des connexions** | Date, résultat, IP, appareil (**sans localisation**) ; *dépend d'un nouvel endpoint* |
| S03 | **Révocation** : confirmation, « tout révoquer sauf celle-ci », confirmation MFA récent | |

### 4.2 Stocks (EXD-07) — 11 écrans
| Réf. | Écran | Contenu |
|---|---|---|
| ST00 | **Tableau de bord Stocks** | Stock total (valeur), ruptures, articles critiques, derniers mouvements, consommation par service |
| ST01 | Articles (liste) | Référence, catégorie, stock, seuil, statut (OK / critique / rupture) |
| ST02 | Fiche article | Stock, seuils, fournisseurs, historique, mouvements |
| ST03 | Catégories | Arborescence simple, nombre d'articles |
| ST04 | Fournisseurs (liste et fiche) | Contact, délais, articles fournis |
| ST05 | **Entrée de stock** | Bon de réception : fournisseur, lignes, quantités, pièce jointe |
| ST06 | **Sortie de stock** | Consommation interne : article, quantité, **service / employé**, motif |
| ST07 | **Inventaire** | Comptage, écarts, validation, mouvement de régularisation |
| ST08 | **Seuils d'alerte** | Seuil et stock de sécurité par article, destinataires |
| ST09 | **Mouvements** | Journal filtrable (type, article, période, auteur), **non modifiable** |
| ST10 | **Historique / consommations internes** | Par article et par service, période, export |

### 4.3 Reporting et incidents (EXD-08) — 12 écrans
| Réf. | Écran | Contenu |
|---|---|---|
| R00 | **Hub Reporting** | Rapports à rendre (échéances), incidents ouverts, derniers rapports |
| R01 | Rapports journaliers | Liste, statut (brouillon, soumis, validé) |
| R02 | Rapports hebdomadaires | idem |
| R03 | Rapports mensuels | idem |
| R04 | Rapports trimestriels | idem |
| R05 | Rapports annuels | idem |
| R06 | **Détail d'un rapport** | Données préremplies + commentaires ; export PDF |
| R07 | **Incidents** (liste, filtres, statuts) | |
| R08 | **Déclarer un incident** | Titre, gravité, module concerné, description, pièces |
| R09 | **Fiche incident** | Chronologie, **attribution**, statut, résolution, clôture |
| R10 | **Rapports des employés** (vue responsable / RH) | Par employé et par période |
| R11 | **Rédiger mon rapport** (vue employé) | Activités, compte rendu, actions suivies, problèmes remontés |
| R12 | **Suivi des performances** | ⚠ sensible : voir §9 ; indicateurs transparents |

### 4.4 Transverses
| Réf. | Écran | |
|---|---|---|
| H00 | **Hub (Vue d'ensemble)** avec navigation complète | EXD-05 |
| Q01 | **Résultats de recherche globale** (groupés par type) | EXD-05 |
| Q02 | Palette de commandes ⌘K | EXD-05 |

**Total** : 18 + 11 + 12 + 3 = **44 écrans à concevoir**, dont **11 existent déjà, au moins en partie, dans l'application** (A01, A02, A05, A07 à A13, S01) : ils sont à **habiller et compléter**. **33 sont entièrement nouveaux.**

---

## 5. Composants à modifier ou à créer

| Composant | Action | Détail |
|---|---|---|
| **AppShell** | modifier | Fond global + panneau ; mode « hub » (navigation complète) et mode « module » (rail compact) |
| **Sidebar** | modifier | Sans pastille Investudy ; variante rail (icônes, info-bulles) |
| **Table** | modifier | Sélection persistante, case d'en-tête, barre d'actions, sélection conservée entre pages |
| **BulkBar** | créer | « n sélectionnées » + actions + désélection |
| **OpportunityCard** | modifier | Version compacte sélectionnable pour la grille de 6 ; états : repos, survol, sélectionnée, retard |
| **CardGrid** | créer | Grille 6 / 4 / 3 / 2 / 1 colonnes avec ordre de lecture ligne par ligne |
| **SegmentedControl** | créer | Cartes / Par étape ; Jour / Semaine / Mois |
| **GlobalSearch** | créer | Champ + palette ⌘K + résultats groupés par type, droits respectés |
| **ModuleTile** | créer | Grande tuile de module pour le hub |
| **StepIndicator** | créer | Barre d'étapes (connexion, enrôlement MFA, réinitialisation) |
| **OtpInput** | créer | 6 cases, collage, annonce vocale |
| **QrPanel / RecoveryCodes** | créer | QR + clé manuelle ; codes copiables, affichage unique |
| **SessionCard** | créer | Appareil, IP, risque, dernière activité, révocation |
| **StockLevelBar / ThresholdBadge** | créer | Niveau de stock vs seuil ; OK / critique / rupture |
| **MovementForm** | créer | Entrée, sortie, régularisation (quantité, motif, pièce) |
| **ReportEditor** | créer | Sections préremplies + commentaires, statut de validation |
| **IncidentTimeline** | créer | Chronologie, attribution, changements de statut |
| **PersonalDataNotice** | créer | Bandeau de transparence sur les vues « performances » |

---

## 6. Navigation mise à jour

**Modèle hub + rail** (EXD-05, proposition à confirmer).

```
HUB — Vue d'ensemble  (navigation complète + recherche globale + tuiles)
│
├─ ESPACE DE TRAVAIL
│   ├─ Agenda
│   ├─ Entreprises                 (Business Development)
│   ├─ Opportunités                (Business Development)   ← ex-« Développement »
│   └─ Formation                   (Training Management — logo Investudy dans l'en-tête de page)
│
├─ OPÉRATIONS
│   ├─ Finance
│   ├─ Ressources humaines
│   ├─ Fiscalité
│   └─ Stocks                      ← NOUVEAU  (articles, catégories, fournisseurs, entrées, sorties,
│                                                inventaire, seuils, mouvements, historique)
├─ PILOTAGE
│   └─ Reporting                   ← NOUVEAU  (rapports périodiques, incidents, rapports des employés)
│
├─ GOUVERNANCE
│   ├─ Administration              (utilisateurs, rôles)
│   └─ Sécurité                    (centre de confiance, journal d'audit)
│
└─ COMPTE (menu du profil, en haut à droite)
    ├─ Mon profil
    ├─ Sécurité du compte          (mot de passe, second facteur, codes de secours)
    ├─ Sessions actives            ← NOUVEAU écran
    └─ Historique des connexions   ← NOUVEAU écran
```

Hors hub : rail compact (icônes), « ← Vue d'ensemble », sous-navigation du module en onglets, recherche ⌘K. Une **page « Hub »** ne remplace jamais le contrôle des droits : un module non autorisé **n'apparaît pas**.

---

## 7. Architecture des modules mise à jour

### 7.1 Contextes métier
| Contexte | Contenu | Produit | État |
|---|---|---|---|
| **Business Development** | Entreprises, contacts, **opportunités**, offres, relances, rendez-vous, agrément, ambassadeurs | CRM | Entreprises faites ; reste S4 |
| **Training Management** (Investudy) | Catalogue, sessions, inscriptions, suivi pédagogique | CRM | S5 |
| **Finance** | Facturation, suivi (hors paiement CRM) | ERP | à venir |
| **RH** | Salariés, congés, dossiers | ERP | à venir |
| **Fiscalité** | Déclarations (Cameroun, OHADA, DGI, CNPS) | ERP | à venir |
| **Administration** (`iam`) | Utilisateurs, rôles, invitations | CRM | fait |
| **Sécurité** | Audit, sessions, tentatives, **incidents de sécurité** | CRM | audit fait ; sessions exposées ; **historique à exposer** |
| **Stocks** *(nouveau)* | Articles, catégories, fournisseurs, mouvements, inventaire, seuils | **ERP (Opérations)** | à décider |
| **Reporting** *(nouveau)* | Rapports périodiques, **incidents opérationnels**, rapports des employés | **Transversal** (lit CRM + ERP) | à décider |
| **Agenda** *(ajouté)* | Événements, rappels | CRM | prévu S4.2b |
| **Recherche** *(transverse)* | Index et point d'entrée `/search` respectant les droits | CRM puis ERP | à prévoir |

### 7.2 Relations (événements, pas de partage de base — ADR-0005)
```
Business Development ─ opportunité gagnée ───────────► Training Management
Training Management ── session confirmée ─────────────► Agenda ; Finance (à facturer)
Stocks ── seuil franchi ─────────────────────────────► Agenda ; Reporting (incident ?) ; Notifications
Reporting ◄─ données agrégées ─ Business Development, Training, Stocks, Sécurité, RH
Sécurité ── événement suspect ───────────────────────► Reporting (incident de sécurité)
RH ── effectifs, absences ───────────────────────────► Reporting (rapports des employés)
```

### 7.3 Impact sur le modèle de droits
Nouvelles permissions (`module.ressource.action`, mêmes portées Propre / Équipe / Tous) :
`stock.article.*`, `stock.category.*`, `stock.supplier.*`, `stock.movement.create|read`, `stock.inventory.*`, `stock.threshold.manage` ·
`report.periodic.read|write|validate`, `incident.create|read|assign|resolve`, `report.employee.read|write`, `report.performance.read` (**la plus restreinte**) ·
`search.use`, `iam.session.read` (existe) + `iam.login_history.read` (à créer).
**Rôles** : « Logistique / Approvisionnement » (gestion des stocks) pourrait être nécessaire : à décider (§9).

### 7.4 Impact sur les données
Nouveaux schémas : `stock` (articles, catégories, fournisseurs, **mouvements en ajout seul**, inventaires, seuils) ; `reporting` (modèles de rapport, rapports, incidents, événements d'incident, rapports d'employé). Les mouvements de stock reprennent la règle du journal d'audit : **immuables**, corrigés par contre-mouvement.

### 7.5 Impact sur le plan (proposé, à valider)
| Ajout | Position proposée |
|---|---|
| Habillage H1–H3 (style, coque, écrans d'accès) | avant S4.1 |
| **Hub, recherche globale, rail** | avec H1 (après confirmation d'EXD-05) |
| Écrans d'authentification restants + sessions + **endpoint d'historique des connexions** | avec H2 (backend minimal inclus) |
| **Reporting et incidents** | après S6.1 (indicateurs), car ils consomment les données commerciales |
| **Stocks** | début de la phase ERP (Opérations) |
> **Commentaire** — Les exigences 5 à 8 ajoutent **33 écrans nouveaux** (et 11 à habiller) et deux contextes métier au périmètre. Cela **allonge sensiblement le plan** ; je ne les ai pas insérés avant S4 sans votre arbitrage.

---

## 8. Recommandations supplémentaires

1. **Un seul centre de notifications et de tâches** : alertes de stock, incidents attribués, rapports à rendre, relances en retard, sessions suspectes. Il alimente l'Agenda et le tableau de bord (évite un « widget d'alerte » par module).
2. **Unifier la notion d'incident** : un cycle de vie commun (déclaré → attribué → en cours → résolu → clos) avec deux types, **opérationnel** et **sécurité** ; un incident de sécurité peut être créé depuis un événement du centre de confiance.
3. **Réutiliser l'audit** pour les mouvements de stock : même principe d'immuabilité, même tableau de consultation, mêmes exports tracés.
4. **Relier le module Documents (S3.6)** : bons de réception, factures fournisseurs, pièces d'incident, rapports PDF.
5. **Préremplir les rapports** à partir des données du système plutôt que demander une double saisie ; garder le commentaire humain pour l'analyse.
6. **Gouvernance des données de performance** : finalités écrites, transparence pour l'employé, accès restreint, durée de conservation, **avis juridique et RH avant construction** ; pas de mesure cachée.
7. **Recherche globale prudente** : elle ne doit jamais élargir les droits (un résultat qu'on ne peut pas ouvrir n'apparaît pas) ; les exports depuis la recherche sont tracés.
8. **Exigences d'accessibilité du hub** : lien d'évitement, ordre de tabulation, rail avec info-bulles accessibles, navigation clavier dans les résultats.
9. **Étendre les jetons** au prochain tour : états « sélectionné », « en alerte », « critique », « résolu », pour que stocks, incidents et rapports parlent la même langue visuelle que le reste.
10. **Prioriser par valeur** : dans Stocks et Reporting, commencer par **le tableau de bord et un seul parcours** (sortie de stock ; déclaration d'incident) avant l'exhaustivité.
11. **Mesurer** : critères de réussite par exigence (ex. « retrouver une entreprise en moins de 5 secondes depuis le hub »).

---

## 9. Décisions et informations à me confirmer

| # | Question | Pourquoi | Ma proposition |
|---|---|---|---|
| 1 | **EXD-05** : le motif **hub + rail compact + ⌘K** convient-il, ou voulez-vous **aucune navigation** hors du hub ? | Impact majeur sur l'efficacité quotidienne et l'accessibilité | Hub + rail compact |
| 2 | **Stocks** : relèvent-ils du **produit CRM** ou de l'**ERP** (ADR-0005) ? Un seul site ? Quelle valorisation (coût moyen, premier entré premier sorti) ? Qui valide les sorties ? | Détermine le contexte, la base et le calendrier | ERP (Opérations), un site, coût moyen pondéré, sortie validée par le responsable de service |
| 3 | **Rôle « Logistique »** à créer ? | Droits `stock.*` | Oui, rôle dédié |
| 4 | **Reporting** : qui doit rédiger quels rapports, à quelle fréquence, avec quel circuit de validation ? | Définit les modèles et les échéances | Journalier : chargés de compte ; hebdomadaire : responsables ; mensuel et au-delà : direction |
| 5 | **Rapports des employés / performances** : finalités, qui voit quoi, durée de conservation ; **validation juridique et RH** | Données personnelles de salariés | Transparence, accès employé + responsable + RH, avis juridique avant construction |
| 6 | **Incidents** : catégories, gravités, délais de résolution ; distinguer sécurité et opérationnel ? | Cycle de vie et tableaux de bord | Deux types, un cycle commun |
| 7 | **Historique des connexions** : durée affichée (30 jours ?), pas de localisation | Nouvel endpoint et confidentialité | 90 jours, IP et appareil seulement |
| 8 | **Ordre de réalisation** : habillage + authentification d'abord, puis S4, puis Reporting et Stocks ? | Le périmètre augmente de 44 écrans | Oui |
| 9 | **Ordre des cartes d'opportunités** | Lisibilité | Prochaine action la plus proche, configurable |

---

## 10. Ce qui est appliqué, vérifié, et ce qui ne l'est pas
**Appliqué et vérifié visuellement** (captures Edge, clair et sombre, dans `docs/design/screens/`) : EXD-01 (panneau sur fond global), EXD-02 (deux lignes d'entreprises et deux cartes d'opportunités sélectionnées de façon persistante, avec barre d'actions), EXD-03 (pastille supprimée), EXD-04 (renommage, 18 cartes en 3 lignes de 6, bascule « Par étape »).
**Mesuré** : contrastes des nouveaux jetons (§2).
**Non appliqué** : EXD-05 à EXD-08 (spécifiés ci-dessus, en attente de vos réponses).
**Non vérifié** : comportement de la sélection avec pagination réelle ; lecteur d'écran ; rendu Safari / Firefox.
