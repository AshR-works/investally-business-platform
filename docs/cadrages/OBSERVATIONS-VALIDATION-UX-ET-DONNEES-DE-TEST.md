# Observations de recette : téléphones, fenêtres, cohérence visuelle, jeu de données de démonstration

**Date** : 2026-11-03 · **Statut** : analyse et plan, **rien n'est encore codé** · **Périmètre** : qualité des validations, corrections d'interface, cohérence visuelle, données de démonstration ; **l'architecture n'est pas modifiée** · **Lié à** : [DESIGN-SYSTEM](../design/01-DESIGN-SYSTEM.md), [CHARTE-DE-TESTS](../CHARTE-DE-TESTS.md), [GUIDE-EXECUTION-LOCALE](../GUIDE-EXECUTION-LOCALE.md)

> Ce document analyse trois observations et le besoin d'un jeu de données complet. Il s'appuie sur ce que contient réellement le dépôt à la date ci-dessus. Les points que je n'ai pas pu vérifier sont signalés ; les valeurs par défaut que j'ai retenues sont marquées **« à confirmer »**.

## 1. En bref

| Sujet | Constat | Priorité | Effort estimé |
|---|---|---|---|
| **O1 Téléphones** | Le contrôle actuel est large (chiffres, `+ - . ( )`, 6 chiffres au moins, 40 caractères) et **ne correspond à aucune de vos règles** ; la règle existe en **une** fonction côté serveur mais en **trois copies** côté interface | **P0** | 1 session |
| **O2 Barre qui déborde** | **Confirmé par vos captures** : la barre de défilement de la fenêtre est collée au bord et déborde sur les angles arrondis ; les boutons d'action défilent avec le formulaire. Une correction commune (un composant, un style) | **P1** | 0,5 session |
| **O3 Cohérence visuelle** | Écarts probables entre pages et vis-à-vis du Design System ; **audit visuel à faire** avant de corriger (je ne l'ai pas encore fait) | **P2** | 1 à 2 sessions |
| **Jeu de données** | Un jeu minimal existe (40 entreprises génériques, un compte par rôle). **Réalisable maintenant** : tout le métier commercial. **Pas réalisable maintenant** : Investudy, finance, reporting (ces modules n'existent pas encore) ; je livre leur **spécification** et leur structure | **P1** (commercial), **P3** (le reste) | 1 à 2 sessions + 1 par module |

**Ce que je ne ferai pas** : changer l'architecture, ajouter des modules, produire des documents (contrats, attestations, factures, fichiers joints, certificats) : conforme à votre consigne.

---

## 2. Observation 1 : validation des numéros de téléphone

### 2.1 État actuel (vérifié dans le code)
- **Serveur** : une seule fonction, `normalizePhone` (`domain/contact-info.ts`), appelée par le **contact**, l'**entreprise**, le **facilitateur** et l'**ambassadeur**. Elle accepte chiffres, espaces et `+ - . ( )`, exige **6 chiffres au moins** et **40 caractères au plus**, et **conserve la mise en forme saisie**.
- **Interface** : la même règle est **recopiée trois fois** (`lib/contacts.ts`, `lib/facilitation.ts`, `lib/ambassadors.ts`) sous la forme d'une expression régulière. Une comparaison avec le domaine réel du serveur existe dans les tests, mais seulement pour la règle actuelle.
- **Base de données** : aucune contrainte sur les téléphones.

### 2.2 Écarts avec vos règles
| Règle attendue | Aujourd'hui |
|---|---|
| 15 chiffres au plus | Non (limite de 40 caractères, aucune limite de chiffres) |
| Ne commence jamais par 0 | Non |
| Espaces acceptés à la saisie, **retirés** à l'enregistrement | Acceptés, **conservés** |
| « + » accepté en première position seulement | Non (`+` accepté partout) |
| Seuls chiffres, espaces et « + » | Non (`- . ( )` acceptés) |

### 2.3 Interprétation de la règle « ne commence jamais par 0 »
Vos exemples valides comprennent `+225 0701234567` : le 0 y suit l'indicatif du pays. La règle cohérente avec **tous** vos exemples est donc : **le premier chiffre du numéro (après un « + » éventuel) n'est pas 0**. `0699123456` est refusé parce qu'il commence par 0 ; `+225 0701234567` est accepté parce qu'il commence par 2. *(À confirmer : si vous voulez aussi refuser un 0 juste après l'indicatif, dites-le, mais `+225 0701234567` deviendrait invalide.)*

### 2.4 Stratégie de validation proposée
**Une seule règle, deux applications, une garantie en base.**

1. **Une fonction de référence** côté serveur (le domaine reste maître) : retire les espaces ; refuse tout caractère autre que chiffre, espace ou « + » ; « + » seulement en tête ; premier chiffre ≠ 0 ; de **8 à 15 chiffres** *(le minimum de 8 est une valeur par défaut, à confirmer ; le maximum est celui de la norme internationale)* ; **stocke** la forme nettoyée `+237699123456` ou `237699123456`.
2. **Côté interface** : une seule fonction partagée (supprime les trois copies), qui **accepte** les espaces en cours de saisie, **affiche** la valeur nettoyée sous le champ une fois sortie du champ, et reprend **exactement** les messages du serveur. Le test de cohérence interface ↔ domaine réel est étendu à la nouvelle règle (cas valides et invalides de votre liste, plus les cas limites).
3. **Base de données** : contrainte `CHECK` sur les téléphones (modèle déjà employé dans le projet : `COALESCE(... , false)`) pour qu'aucune écriture directe ne contourne la règle.
4. **Données existantes** : avant la contrainte, un **nettoyage** des téléphones déjà saisis (retrait des espaces et séparateurs ; liste des valeurs qui restent invalides, à corriger à la main, **jamais effacées automatiquement**). Les données de démonstration actuelles sont régénérées.

### 2.5 Règles et messages
| Cas | Message d'erreur (même texte côté interface et serveur) |
|---|---|
| Caractère interdit (`-`, `(`, `)`, `.`, lettre) | « Le numéro ne peut contenir que des chiffres, des espaces et un « + » au début. » |
| « + » ailleurs qu'en tête, ou doublé | « Le « + » n'est accepté qu'au début du numéro, une seule fois. » |
| Premier chiffre 0 | « Le numéro ne doit pas commencer par 0 : indiquez l'indicatif du pays (ex. +237 699 12 34 56). » |
| Plus de 15 chiffres | « Le numéro ne peut pas dépasser 15 chiffres. » |
| Moins de 8 chiffres | « Le numéro est trop court (8 chiffres au moins). » |
| Vide alors qu'obligatoire (facilitateur) | « Le numéro de téléphone est obligatoire. » |

### 2.6 Recommandations d'interface
- Champ `type="tel"` avec `inputMode="tel"` et `autoComplete="tel"` (déjà `tel` ; ajouter les deux autres).
- **Texte d'aide permanent** sous le champ : « Avec l'indicatif du pays, par exemple +237 699 12 34 56 ». Il remplace l'erreur en cas de doute.
- **Ne pas bloquer la frappe** (pas de masque qui efface des caractères) : on laisse saisir, on signale à la sortie du champ, et on propose la forme nettoyée.
- Affichage des numéros enregistrés avec un regroupement lisible (ex. `+237 699 12 34 56`) **sans** changer la valeur stockée.

### 2.7 Jeu d'essai (à intégrer aux tests)
Valides : `+237 699 12 34 56` · `+225 0701234567` · `+33 6 12 34 56 78` · `237699123456`. Invalides : `0699123456` · `++237699123456` · `+237-699123456` · `+237(699)123456` · `+237 699 12 34 56 78 90 12` (plus de 15 chiffres) · `69912` (trop court) · `+` seul · `237+699123456`.

---

## 3. Observation 2 : barre qui déborde des fenêtres

### 3.1 Diagnostic confirmé par vos captures (2026-11-03)
Les trois captures (Nouvelle entreprise, Nouvel ambassadeur, Nouveau rendez-vous) montrent la même chose : la **barre de défilement verticale de la fenêtre** est collée au bord extérieur de la fenêtre et **déborde sur les coins arrondis** (flèches haute et basse dans les angles, rail qui dépasse du cadre). Ce n'est pas un curseur ni une barre de progression : le mot « trackbar » désignait ce rail.

**Cause, vérifiée dans le style** (`app/globals.css`, `.dialog`) : la fenêtre elle-même est la zone de défilement (`overflow: auto`) **et** porte le rayon d'angle et le remplissage (`padding: 1.5rem`). Le navigateur place donc la barre à l'extrême bord de la boîte, **par-dessus les arrondis**, sans marge. Conséquences visibles :
1. barre et flèches en contact avec les angles de la fenêtre ;
2. la largeur du contenu change quand la barre apparaît (pas de gouttière réservée) ;
3. **les boutons « Retour » et « Enregistrer » défilent avec le formulaire** : sur la première capture ils sont à moitié coupés en bas, sous la flèche indiquée ; sur les deux autres il faut défiler pour les atteindre.

### 3.2 Autres causes possibles à vérifier (pas vues sur vos captures)
- Un tableau dans une fenêtre large (panneau Documents) peut ajouter une seconde barre, horizontale, dans la fenêtre.
- À 320 ou 375 px, la largeur minimale des fenêtres larges peut provoquer un débordement horizontal.

### 3.3 Correction recommandée (sans toucher à l'architecture)
Un seul composant (`modal.tsx`) et un seul endroit de style (`globals.css`) : toutes les fenêtres sont corrigées d'un coup.
1. **Séparer le cadre et le défilement** : la fenêtre devient un cadre (`overflow: hidden`, rayon, bordure) en colonne ; l'**en-tête** (titre et croix) reste fixe ; seul un **corps** intérieur défile, avec son propre remplissage. La barre se retrouve **à l'intérieur** du cadre, à distance des angles.
2. **Barre discrète et stable** : `scrollbar-gutter: stable` (la largeur ne saute plus), `scrollbar-width: thin` et couleurs des jetons du design (clair et sombre).
3. **Boutons d'action toujours visibles** : la ligne « Retour / Enregistrer » reste collée en bas du corps (`position: sticky`), avec un fond et un filet de séparation.
4. **Largeur** : `max-width: calc(100vw - 2rem)` et `min-width: 0` sur les enfants de grille, `overflow-wrap: anywhere` ; tableaux dans `table-wrap` ; une seule zone de défilement pour le panneau Documents.
5. **À ne pas faire** : `overflow-x: hidden` sur la fenêtre (cache le débordement et nuit à l'accessibilité).

**Vérification** : le script d'audit navigateur ouvre chaque fenêtre à 320, 375, 768 et 1280 px, contrôle l'absence de débordement horizontal, que les boutons d'action sont visibles sans défiler, et prend des captures avant et après (thèmes clair et sombre).

**Composants concernés** : `components/modal.tsx`, `app/globals.css` (`.dialog`, `.dialog.wide`, `.dialog-head`, `.overlay`) ; contrôle visuel des fenêtres de `components/{companies,contacts,offers,appointments,approvals,ambassadors,documents}/*` et de `components/confirm-dialog.tsx`, `components/step-up-dialog.tsx`.

---

## 4. Observation 3 : cohérence des interfaces

### 4.1 Ce que j'ai constaté dans le code
- Le Design System (`docs/design/01-DESIGN-SYSTEM.md`) décrit : une **structure de page en cinq parties** (fil d'Ariane, étiquette de domaine, titre avec aide et actions, **carte héros ou indicateurs**, contenu), des **rayons** précis (cartes 22 px, cartes de liste 14, boutons et champs 10) et une **seule couleur de marque**.
- Le composant `Card` est employé sur les pages et les panneaux, mais **plusieurs pages et composants posent encore leurs propres bordures et arrondis** (`rounded-…`, `border …` dans l'agenda, la liste des entreprises, les opportunités, l'accueil, la barre latérale, l'administration).
- Le composant `PageHeading` est employé par presque toutes les pages principales ; la page **Ambassadeurs** et celles des modules les plus récents sont à contrôler.
- Il n'existe **pas encore** de carte héros ni de cartes d'indicateurs (elles viennent avec le reporting, S6) : leur absence n'est pas un écart.

### 4.2 Écarts à qualifier (liste de départ, à compléter par l'audit)
| # | Écart probable | Où | Comment le confirmer |
|---|---|---|---|
| E1 | Cartes posées à la main au lieu de `Card` | agenda, entreprises, opportunités, accueil | revue du code et captures |
| E2 | Hiérarchie de page variable (titre, aide, actions, ordre des blocs) | pages récentes contre pages anciennes | grille de comparaison page par page |
| E3 | Panneaux de la fiche entreprise sans mise en page commune (titre de section, bouton d'action, état vide) | `components/*/…-panel.tsx` | comparaison des 8 panneaux |
| E4 | Fenêtres : taille, boutons « Retour / Enregistrer » et textes d'aide non homogènes | `components/*/…-dialog.tsx` | inventaire des fenêtres |
| E5 | États vides, de chargement et d'erreur de styles différents | listes et panneaux | inventaire |
| E6 | Rayons et espacements hors jetons | styles ponctuels | recherche des valeurs en dur |

### 4.3 Plan de réalignement (sans refonte)
1. **Inventaire** (0,5 session) : une grille « page ou composant × élément du Design System » (structure de page, carte, rayon, titre, bouton principal, état vide) remplie à partir du code **et** de captures prises par le script d'audit, dans le thème clair et sombre.
2. **Règles** : n'utiliser que `Card`, `PageHeading`, la barre d'outils de tableau et les jetons ; documenter dans le Design System les **trois gabarits** déjà présents (liste, fiche à panneaux, fenêtre) plutôt que d'en inventer.
3. **Correction par lots**, du plus visible au moins visible : accueil et entreprises, fiche et panneaux, agenda et opportunités, fenêtres.
4. **Garde-fou** : un test qui interdit les couleurs et rayons en dur hors des jetons, et un contrôle visuel par page dans l'audit navigateur.

---

## 5. Jeu de données de démonstration

### 5.1 Ce qui existe et ce qui est possible
| Domaine demandé | État de l'application | Ce que je peux faire |
|---|---|---|
| Entreprises, contacts, prospects, partenaires | **Existe** (entreprises, contacts, facilitateurs avec commission) | Seed complet |
| Opportunités, pipeline, rendez-vous, historique | **Existe** (opportunités en 5 étapes, agenda, relances, offres, décharges, agréments, ambassadeurs, audit) | Seed complet |
| « Tâches » | Les **relances** en tiennent lieu | Seed via les relances |
| « Devis » | Les **offres** en tiennent lieu | Seed via les offres (tous les états) |
| Administration : utilisateurs, rôles, permissions, équipes | **Existe** ; l'équipe est un lien responsable → collaborateur ; **pas de notion de département** | Seed d'une organisation par fonctions (voir 5.4) |
| **Investudy** : programmes, sessions, formateurs, participants, inscriptions, certifications | **N'existe pas** (lot S5) | **Spécification et fichiers de données prêts**, chargés quand le module existe |
| **Finance** : paiements, revenus, dépenses, centres de coûts | **N'existe pas** ; le CRM ne suit pas les paiements (décision D5, ERP séparé) | Spécification seulement |
| **Reporting** : indicateurs, graphiques, comparaisons mensuelles | **N'existe pas** (lot S6) | Les données du CRM sont **réparties sur 12 mois** pour l'alimenter ; le reste suivra |

Créer des tables « en avance » pour Investudy ou la finance serait une **modification d'architecture** : je ne le fais pas.

### 5.2 Principes
1. **Fictif intégral** : le dépôt est public. **Aucune vraie raison sociale ni personne réelle** : noms d'entreprises inventés (inspirés des secteurs et des pays, sans reprendre de marque existante), personnes inventées, adresses e-mail en `.test`, numéros inventés mais **valides** selon la nouvelle règle. *(Choix par défaut, à confirmer : des marques réelles dans un dépôt public pourraient laisser croire à une relation commerciale.)*
2. **Réaliste** : pays d'Afrique centrale et de l'Ouest (Cameroun surtout, Côte d'Ivoire, Sénégal, Gabon, RDC), devise XAF (et EUR, USD pour quelques offres), TVA 19,25 % si utile, noms africains variés.
3. **Passer par le domaine** : le seed utilise les mêmes règles que l'application (validation, états, versions, audit), pas des `INSERT` bruts. Les données actuelles de `local-stack --demo` contournent la validation : c'est ce qui laisse passer des téléphones non conformes.
4. **Déterministe et répétable** : générateur à graine fixe, dates **relatives à aujourd'hui** (« il y a 45 jours », « dans 6 jours ») pour que les écrans, les retards et les graphiques restent parlants, identifiants stables, rejouable sans doublon.
5. **Garde-fous** : refuse de s'exécuter hors base locale ou jetable ; jamais en production.

### 5.3 Structure proposée
```
apps/crm-api/seed/
  fixtures/                 données lisibles (JSON), versionnées
    organisation.json       fonctions, équipes, comptes de démonstration
    entreprises.json        ~40 entreprises (secteur, pays, statut, responsable)
    contacts.json           ~120 contacts (rôle : dirigeant, financier, prescripteur…)
    facilitateurs.json      ~8 facilitateurs et leur commission
    commercial.json         offres, décharges, relances, rendez-vous, opportunités, agréments, ambassadeurs
    investudy.json          (spécifié ; chargé quand S5 existe)
    finance.json            (spécifié ; chargé quand le module existe)
  scenarios/                scénarios de recette (un fichier par persona)
  seed-demo.ts              commande : charge les fixtures par les cas d'usage
  validate-fixtures.spec.ts contrôles de cohérence (voir 5.6)
```
Trois profils : **minimal** (les 25 entreprises génériques actuelles, pour les tests automatiques), **demo** (jeu complet réaliste), **volume** (milliers de lignes, pour la lenteur et la pagination).

### 5.4 Contenu proposé (volumes et couverture)
**Organisation (par fonctions, sans noms de personnes réelles)** : 1 Super administrateur, 1 Direction (CEO), 1 Direction + RH (DGA), 1 Finance (DAF), 1 Responsable commercial et **3 chargés de compte** (pour que la portée « propres objets / équipe » soit testable), 1 responsable de formation, 1 support, 1 « conformité » *si FD-10 est retenu*, 2 formateurs externes sans compte. Un compte par rôle existe déjà (`create-demo-users`).

**Entreprises (~40)** : banques et établissements de microfinance, fintechs, assurances, sociétés de gestion de patrimoine, sociétés de bourse, télécoms, industries, PME, grandes entreprises ; répartition des **statuts** (cible, contactée, qualifiée, cliente, archivée) et des responsables entre les trois chargés de compte ; quelques entreprises **sans contact** (pour tester la règle « Qualifiée »).

**Exemples d'entreprises fictives** (liste complète produite lors du lot) :

| Nom fictif | Secteur | Pays |
|---|---|---|
| Banque du Wouri Capital | Banque | Cameroun |
| Sahel Fintech Pay | Fintech | Sénégal |
| Assurances Mont-Cameroun | Assurance | Cameroun |
| Kivu Patrimoine et Gestion | Gestion de patrimoine | RDC |
| Courtage Boursier de l'Équateur | Société de bourse | Gabon |
| Télécom Delta Afrique | Télécoms | Côte d'Ivoire |
| Fonderies Littoral Industrie | Industrie | Cameroun |
| Cabinet Savane Conseil (PME) | Services | Côte d'Ivoire |

**Contacts (~120)** : dirigeants, responsables financiers, prescripteurs, un contact principal par entreprise ; quelques **doublons probables** (pour la détection) ; numéros et e-mails fictifs valides.

**CRM commercial** (couvre tous les états et les cas limites) :
- **Offres (~50)** : brouillon, déposée, en attente de décharge, acceptée, refusée, retirée ; plusieurs devises.
- **Décharges et relances** : valides et annulées ; relances à venir, **en retard**, faites, annulées.
- **Rendez-vous** : tenus, à venir, annulés ; avec et sans lien à une opportunité ; avec un **décideur**.
- **Opportunités (~45)** : toutes les étapes, quelques-unes **perdues** (avec motifs variés), **gagnées**, une avec **dérogation** ; montants étalés pour des totaux crédibles.
- **Agréments (~12)** : demandé, reçu, honoré, expiré, annulé ; avec et sans **payeur tiers** ; entreprises devenues clientes.
- **Ambassadeurs (~6)** : clients et apprenants.
- **Historique** : le journal d'audit se remplit de lui-même parce que le seed passe par le domaine ; dates de création **réparties sur 12 mois** pour les comparaisons mensuelles.

**Investudy (spécifié)** : ~8 programmes (marchés financiers, gestion de patrimoine, conformité, fintech…), ~14 sessions (passées, en cours, à venir, complètes, annulée), ~6 formateurs externes, ~120 participants, inscriptions (confirmées, en attente, annulées), présences, évaluations et certifications obtenues ou non.

**Finance (spécifiée, hors périmètre actuel)** : paiements (reçus, partiels, en retard), revenus par mois et par ligne, dépenses par centre de coûts (ex. formation, marketing, informatique, administration), pour le reporting financier.

### 5.5 Stratégie d'intégration dans les environnements
| Environnement | Profil | Comment |
|---|---|---|
| Tests automatiques (base jetable) | minimal | inchangé ; option `--seed demo` de `test-db.mjs` pour les parcours de bout en bout |
| Poste de développement | demo | `node scripts/local-stack.mjs --demo` charge le jeu complet (remplace les 40 entreprises génériques) ; comptes de démonstration inchangés |
| Audit navigateur (accessibilité) | demo | le parcours actuel crée ses propres données ; ajout d'un parcours « base remplie » |
| Recette utilisateur | demo | scénarios de recette par persona ; réinitialisable en une commande |
| Performance et pagination | volume | à la demande |
| Production | **aucun** | le seed refuse de s'exécuter |

### 5.6 Stratégie de validation des données
1. **Les validateurs de l'application** passent sur chaque ligne (téléphones, e-mails, montants, dates, états) : une fixture invalide fait échouer le chargement et le test.
2. **Cohérence métier** (test automatique) : une opportunité gagnée a franchi l'accord de principe ; un agrément honoré a d'abord été reçu ; une entreprise cliente a un agrément ; un facilitateur a un téléphone ; aucune date d'événement passé dans le futur ; un chargé de compte ne possède que des entreprises de son équipe ; un seul agrément actif par opportunité.
3. **Unicité** : noms d'entreprises, e-mails de contacts et d'ambassadeurs.
4. **Couverture** (test automatique) : chaque état de chaque entité apparaît au moins une fois ; chaque rôle voit au moins une ligne dans chaque liste de sa portée.
5. **Hygiène du dépôt public** : un contrôle refuse tout e-mail hors `.test`, tout numéro hors du motif fictif réservé, toute liste de marques réelles.
6. **Déterminisme** : deux exécutions donnent les mêmes données (à la date près).

---

## 6. Priorisation et tâches à créer

| Id | Tâche | Priorité | Dépend de | Critère d'acceptation |
|---|---|---|---|---|
| **T1.1** | Règle de téléphone unique côté serveur (domaine) + messages | P0 | — | Jeu d'essai du 2.7 : valides acceptés, invalides refusés ; stockage nettoyé |
| **T1.2** | Règle partagée côté interface (supprime 3 copies), aide permanente, `inputMode` | P0 | T1.1 | Même décision que le serveur sur le jeu d'essai (test de cohérence) |
| **T1.3** | Nettoyage des téléphones existants + contrainte `CHECK` en base | P0 | T1.1 | Rapport des valeurs non conformes ; aucune effacée ; écriture directe invalide refusée |
| **T1.4** | Mutants et audit navigateur de la règle | P0 | T1.1, T1.2 | Mutants tués ; 0 violation d'accessibilité |
| **T2.1** | Correction commune des fenêtres : cadre fixe, corps défilant, boutons d'action visibles, barre discrète (`globals.css`, `modal.tsx`) | P1 | — | Sur vos trois captures : barre à l'intérieur du cadre, boutons visibles sans défiler |
| **T2.2** | Mesure du débordement de toutes les fenêtres à 320, 375, 768, 1280 px dans l'audit navigateur (clair et sombre) | P1 | T2.1 | Aucun débordement ; test de non-régression |
| **T3.1** | Inventaire des écarts au Design System (grille + captures claires et sombres) | P2 | — | Grille remplie, écarts E1 à E6 confirmés ou écartés |
| **T3.2** | Réalignement par lots + garde-fou contre les valeurs en dur | P2 | T3.1 | Pages conformes aux trois gabarits |
| **T4.1** | Squelette du seed (commande, garde-fous, validation du plan) : **fait** (le profil « minimal » reste les 25 entreprises génériques des tests ; le profil « volume » n'est pas fait) | P1 | T1.1 | Charge, rejoue sans doublon, refuse la production et toute base non locale |
| **T4.2** | Plan des entreprises, contacts, facilitateurs : **fait** (40 entreprises, 84 contacts, facilitateurs et commissions) | P1 | T4.1 | Couverture 5.6 |
| **T4.3** | Plan commercial (offres, relances, rendez-vous, opportunités, agréments, ambassadeurs), dates relatives, 12 mois : **fait** (559 événements) | P1 | T4.2 | Tous les états présents ; totaux crédibles |
| **T4.4** | Intégration : `local-stack --demo` **fait** ; `test-db --seed demo` non fait (D135) ; scénarios de recette par persona non faits | P1 | T4.3 | Chaque rôle parcourt son espace avec des données |
| **T4.5** | Fixtures Investudy et finance, chargées avec leurs modules | P3 | S5, module finance | Spécification livrée maintenant, chargement plus tard |

**Statut au 2026-11-03** : T1.1 à T1.4 et T2.1 **faits** (correctifs de recette 1, validés ; recette `SPRINT-CORRECTIFS-1-RECETTE.md`) ; T2.2 **partiel** (une seule fenêtre mesurée, D132) ; T3.1 et T3.2 **non faits** ; T4.1 à T4.4 **faits pour le module commercial** (recette `SPRINT-JEU-DE-DONNEES-RECETTE.md`) ; T4.5 **non fait** (modules absents).

**Ordre conseillé** : T1.x d'abord (risque de données invalides déjà en base), T2.x en parallèle (rapide), puis T4.x (les données servent à constater T3.x), puis T3.x.

## 7. Points à confirmer (valeurs par défaut appliquées)
| # | Point | Valeur par défaut |
|---|---|---|
| Q1 | Règle « pas de 0 » : premier chiffre après le « + » éventuel | Oui (`+225 0701234567` valide) |
| Q2 | Minimum de chiffres d'un numéro | 8 |
| Q3 | Forme stockée | Sans espace, « + » conservé (`+237699123456`) |
| Q4 | Contrainte `CHECK` en base et nettoyage des données existantes | Oui |
| Q5 | « Trackbar » = barre de défilement des fenêtres | **Confirmé** par les captures du 2026-11-03 |
| Q6 | Noms d'entreprises et de personnes entièrement fictifs | Oui (dépôt public) |
| Q7 | Seed par les cas d'usage plutôt que par `INSERT` | Oui |
| Q8 | Investudy et finance : spécification seule tant que les modules n'existent pas | Oui |
| Q9 | Où placer ces lots dans le calendrier : avant S4.4c, ou après | **Votre décision** (T1.x est petit et réduit un risque de données ; je le recommande avant S4.4c) |

## 8. Ce qui ne change pas
L'architecture, les modules, les droits, le modèle de données hors la contrainte de téléphone, les documents (aucun contrat, attestation, facture, fichier joint ni certificat n'est généré).
