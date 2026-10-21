# Aide à la décision — arbitrages ouverts et gouvernance des livrables design

**Date** : 2026-10-21 · **Méthode** : [METHODE-D-ARBITRAGE.md](../METHODE-D-ARBITRAGE.md) · **Références** : [03-EXIGENCES-DE-CONCEPTION.md](03-EXIGENCES-DE-CONCEPTION.md), [04-ANALYSE-D-IMPACT.md](04-ANALYSE-D-IMPACT.md), ADR-0005

> **Posture** : je n'ai arrêté aucune décision. Chaque arbitrage se termine par **ma recommandation**, présentée comme telle ; **la décision reste la vôtre** (case « Décision » à compléter).
> **Notation** : 1 = défavorable, 5 = favorable. Réversibilité : 🟢 facile · 🟡 moyenne · 🔴 coûteuse. *Les hypothèses sont étiquetées (H) ; tout le reste est vérifié dans le dépôt ou dans les prototypes. Les scores sont des **aides** : ils reflètent mon jugement et les poids affichés, que vous pouvez modifier (le total se recalcule : Σ note × poids).*

## Faits de départ (vérifiés)
- **≈ 20 utilisateurs** (10 employés aujourd'hui) ; sprints courts menés par vous et moi ; API NestJS + interface Next.js ; **une base PostgreSQL par produit** (ADR-0005), événements entre produits, **aucun paquet partagé tant que l'ERP n'existe pas**.
- **Livré** : socle d'accès complet (S0 à S3.5) ; **en attente de votre validation** : S3.4 et S3.5. **Bloquants externes** : accès Microsoft 365, deux SuperAdmin, avis juridique sur l'audit de 10 ans.
- **Prototype** : 9 écrans (+ agenda), clair et sombre, EXD-01 à 04 appliquées ; EXD-05 à 08 spécifiées (44 écrans, dont 33 nouveaux).

---

# PARTIE I — Gouvernance du versionnement des livrables UX/UI

## I.1 Besoins à couvrir
Conserver l'historique complet · repérer les évolutions · **comparer deux versions** · **revenir en arrière** · tracer **pourquoi** une décision de design a été prise.

## I.2 Les options

### Option A — Versionnement simple par dossiers
Copies datées : `design_v1/`, `design_v2_final/`, `design_v2_final_corrigé/`…
| | |
|---|---|
| **Avantages** | Aucun outil ; compréhensible par tous ; retour en arrière = rouvrir un dossier |
| **Inconvénients** | **Duplication massive** ; aucune différence lisible entre versions ; noms ambigus (« final2 ») ; décisions non reliées aux changements ; dérive entre copies |
| **Complexité** | Très faible au départ, **croissante** (le désordre augmente avec le temps) |
| **Adaptation au projet** | **Faible** : le dépôt Git fournit déjà un historique gratuit ; refaire des copies à la main serait régressif |

### Option B — Versionnement par releases
Un numéro de version (`v1.0`, `v1.1`) et un instantané figé à chaque jalon validé (étiquette Git + archive des livrables).
| | |
|---|---|
| **Avantages** | Jalons nets, **traçables** ; retour en arrière précis ; langage commun (« version 1.2 validée ») |
| **Inconvénients** | Entre deux releases, l'historique fin n'est pas rattaché aux décisions ; sans convention, les numéros perdent leur sens |
| **Complexité** | Faible à moyenne |
| **Adaptation au projet** | **Bonne** : cohérent avec vos validations (« Je valide Sx ») et les étiquettes déjà posées par sprint |

### Option C — Versionnement de type Design System
Semver du système (MAJOR rupture · MINOR ajout · PATCH correction), **journal des modifications** par composant, jetons versionnés, dépréciations annoncées, décisions de design consignées (*Design Decision Records*).
| | |
|---|---|
| **Avantages** | **Rigueur maximale** ; compatibilité et dépréciations maîtrisées ; excellent pour de nombreuses équipes et plusieurs produits |
| **Inconvénients** | **Lourd** pour une équipe de deux ; surcoût de rédaction ; utile surtout quand plusieurs équipes consomment le système |
| **Complexité** | Élevée |
| **Adaptation au projet** | **Moyenne** : on y viendra avec l'ERP (deux produits consommateurs) ; en faire trop maintenant ralentirait |

### Option D — Approche recommandée : **Git comme source de vérité + releases sémantiques + journal de décisions légers**
Combine le meilleur de B et C **sans la charge** de C :
1. **Git** garde tout l'historique ligne à ligne (aucune copie de dossiers).
2. **Releases** : à chaque validation, une **version sémantique** `design-vMAJEUR.MINEUR.CORRECTIF` (étiquette Git) et un **instantané visuel** des écrans.
3. **Journal des modifications** unique (`CHANGELOG-DESIGN.md`) rédigé pour des humains.
4. **Registre des décisions de design** (DDR) : une fiche courte par décision, reliée aux exigences EXD et aux versions.
5. **Comparaison visuelle** par une page « avant / après » générée à partir de deux instantanés.
| | |
|---|---|
| **Avantages** | Historique complet, **comparaison**, **retour arrière en une commande**, traçabilité des **pourquoi** ; charge faible (le gros du travail est automatisable) ; évolue vers l'option C sans migration |
| **Inconvénients** | Demande de la **discipline** (tenir le journal et les fiches) ; les instantanés visuels pèsent dans le dépôt (≈ 3 Mo par version à 18 captures : acceptable jusqu'à une trentaine de versions, au-delà on les sort du dépôt) |
| **Complexité** | Faible à moyenne |
| **Adaptation au projet** | **Très bonne** : réutilise Git, les étiquettes, vos validations et le registre existant |

### Grille comparative
| Critère (poids) | A Dossiers | B Releases | C Design System | **D Recommandée** |
|---|---|---|---|---|
| Historique complet (5) | 2 | 4 | 5 | **5** |
| Comparer deux versions (5) | 1 | 3 | 4 | **5** |
| Retour arrière (4) | 3 | 5 | 5 | **5** |
| Traçabilité des décisions (5) | 1 | 3 | 5 | **5** |
| Légèreté / faible charge (4) | 4 | 4 | 1 | **4** |
| Adaptation équipe de deux (4) | 3 | 4 | 2 | **5** |
| Évolutivité vers l'ERP (3) | 1 | 3 | 5 | **4** |
| **Score pondéré / 150** | **63** | **111** | **117** | **143** |

> **Recommandation** : **option D**. Elle donne l'essentiel de C pour la moitié de la charge, et s'appuie sur ce que vous utilisez déjà (Git, étiquettes, « Je valide »).
> **Décision** : ☐ A ☐ B ☐ C ☐ D ☐ autre : ______ · Date : ______

## I.3 Arborescence cible (option D)
```
docs/design/
├── README.md                         index, version courante, comment lire et comparer
├── VERSION                           ex. 0.3.0
├── CHANGELOG-DESIGN.md               « quoi de neuf » par version, pour des humains
├── 01-DESIGN-SYSTEM.md               documents vivants (versionnés par Git)
├── 02-SPECIFICATIONS-FRONTEND.md
├── exigences/
│   └── REGISTRE-EXD.md               exigences EXD (ex-03), jamais effacées
├── decisions/
│   ├── REGISTRE-DDR.md               index : statut, version, exigence liée
│   ├── DDR-0001-style-taupe-et-contrastes.md
│   ├── DDR-0002-theme-sombre.md
│   └── DDR-0003-navigation.md        (à rédiger après votre arbitrage)
├── prototype/                        source vivante (HTML, CSS, JS, jetons, polices, logos)
├── screens/                          derniers rendus (clair et sombre)
├── releases/                         instantanés FIGÉS des versions validées
│   ├── v0.1.0/ {NOTES.md, MANIFEST.md, screens/}
│   ├── v0.2.0/
│   └── v0.3.0/
└── outils/
    ├── render-screens.mjs            génère les captures (clair et sombre)
    ├── release.mjs                   fige une version : captures, MANIFEST (empreintes), étiquette Git
    └── compare.html                  page de comparaison côte à côte et curseur entre deux versions
```
**Conventions**
| Sujet | Règle |
|---|---|
| Numérotation | **MAJEUR** : rupture visuelle ou de navigation · **MINEUR** : nouveaux écrans ou composants · **CORRECTIF** : retouches sans changement de sens |
| Étiquette Git | `design-v0.3.0` (distincte des étiquettes de sprint `sN-validated`) |
| Cycle d'une version | *Proposée* → *En revue* → **Validée par la direction produit** → *Figée* (dossier `releases/`) |
| Fiche de décision (DDR) | Contexte, options (renvoi à l'arbitrage), décision, motif, **version concernée**, exigences liées, statut (*proposée, acceptée, remplacée, rejetée*) |
| Comparer deux versions | Texte : `git diff design-v0.2.0 design-v0.3.0 -- docs/design` · Visuel : `outils/compare.html?a=v0.2.0&b=v0.3.0` |
| Revenir en arrière | `git checkout design-v0.2.0 -- docs/design` (consultation) ou `git revert` (annulation tracée) ; **jamais** de réécriture d'historique |
| Lien avec le code | Chaque version de design nomme le sprint qui l'implémente ; chaque sprint cite la version de design appliquée |

**Reprise de l'existant (rétroactive, sans perte)** :
| Version | Contenu | Commit de référence |
|---|---|---|
| `design-v0.1.0` | Premier prototype, design system, logos fournis | `0f867a9` … `35d4abf` |
| `design-v0.2.0` | + Agenda, tous les écrans en clair et en sombre | `1687304` |
| `design-v0.3.0` | + Exigences EXD-01 à 04 (panneau, sélection persistante, Opportunités en cartes) | `0b72ce4` |

---

# PARTIE II — ARBITRAGE 1 : Navigation globale

## Contexte
EXD-05 demande que la **navigation complète n'apparaisse que dans « Vue d'ensemble »**, devenue hub et moteur de recherche global. Question : comment l'interpréter, avec quelles conséquences sur la productivité et le mobile ? Déjà acquis : recherche globale, modules dans une barre latérale pour l'instant, thème clair et sombre.

## Option A — Navigation complète **uniquement** sur la vue d'ensemble
Ailleurs : aucune barre latérale ; fil d'Ariane et bouton « Vue d'ensemble ».
| | |
|---|---|
| **Avantages** | Pages de contenu **épurées** ; hub riche ; fidèle à la lettre d'EXD-05 ; peu de code de navigation |
| **Inconvénients** | Passer d'un module à un autre impose **de repasser par l'accueil** ; dépend fortement de la recherche ; moins de repères |
| **Impacts UX** | Charge mentale plus forte hors du hub ; bon pour la découverte, mauvais pour la répétition |
| **Impacts mobiles** | **Naturel** sur téléphone (un écran = un contenu) mais sans accès rapide aux modules |
| **Impacts productivité** | **Négatifs** : +1 à +2 clics par changement de module ; pour un chargé de compte qui alterne agenda, entreprises, opportunités 30 fois par jour, c'est un coût réel (H) |
| **Impacts techniques / maintenance** | Faibles ; mais un module oublié dans le hub devient **introuvable** |
| **Accessibilité** | Exige plusieurs moyens de navigation (WCAG 2.4.5) : la recherche seule ne suffit pas |
| Réversibilité | 🟢 |

## Option B — Hub principal + **rail compact** (proposition actuelle)
Hub : navigation complète. Autres pages : rail d'icônes (72 px) avec info-bulles, « ← Vue d'ensemble », sous-navigation du module, recherche ⌘K.
| | |
|---|---|
| **Avantages** | Navigation **toujours à un clic** ; contenu large ; garde l'esprit d'EXD-05 (la navigation *détaillée* est au hub) |
| **Inconvénients** | **Icônes seules** : apprentissage nécessaire ; deux états de navigation à maintenir ; icônes à bien choisir |
| **Impacts UX** | Bon compromis ; risque de confusion pour les nouveaux utilisateurs sur la signification des icônes |
| **Impacts mobiles** | Rail remplacé par un **tiroir** ; cohérent |
| **Impacts productivité** | **Quasi neutres** par rapport à la barre complète |
| **Impacts techniques / maintenance** | Moyens : deux modes de coque, test de focus et d'info-bulles accessibles |
| Réversibilité | 🟢 |

## Option C — **Barre latérale pliable au choix de l'utilisateur** (alternative pertinente)
Barre complète partout par défaut ; bouton pour la **plier en rail** ; la préférence est mémorisée ; le hub reste la page d'accueil enrichie.
| | |
|---|---|
| **Avantages** | **Standard éprouvé** (outils de travail modernes) ; chacun choisit ; pas d'apprentissage imposé ; un seul composant |
| **Inconvénients** | S'écarte de la **lettre** d'EXD-05 (la navigation complète est visible partout par défaut) ; les pages sont moins « épurées » par défaut |
| **Impacts UX** | Très bons ; **efficacité maximale** pour les usages répétitifs |
| **Impacts mobiles** | Tiroir ; identique à B |
| **Impacts productivité** | **Positifs** |
| **Impacts techniques / maintenance** | **Faibles** : un seul composant à deux états |
| Réversibilité | 🟢 |

### Variante recommandée « B+ » (hybride de B et C)
Comme B (**rail compact par défaut hors du hub**, navigation complète au hub), **avec un bouton « Déplier »** qui montre la navigation complète partout, préférence mémorisée. Cela respecte EXD-05 **par défaut** tout en laissant la main à l'utilisateur.

## Grille comparative
| Critère (poids) | A | B | C | **B+** |
|---|---|---|---|---|
| Valeur métier / productivité (5) | 2 | 4 | 5 | **5** |
| Fidélité à EXD-05 (4) | 5 | 4 | 2 | **4** |
| Expérience utilisateur (4) | 2 | 4 | 5 | **5** |
| Accessibilité (4) | 2 | 4 | 4 | **5** |
| Mobile (3) | 4 | 4 | 4 | **4** |
| Coût et maintenance (3) | 5 | 3 | 4 | **3** |
| Réversibilité (4) | 5 | 5 | 5 | **5** |
| **Score pondéré / 135** | **93** | **109** | **113** | **122** |

> **Recommandation** : **B+** (rail compact par défaut + bouton Déplier). Si vous tenez à la **lettre** d'EXD-05, **B** ; **A** seulement si vous acceptez un coût de productivité mesurable.
> **Ce qui me ferait changer d'avis** : un essai avec 3 utilisateurs montrant que le rail compact est mal compris → bascule vers C.
> **Décision** : ☐ A ☐ B ☐ B+ ☐ C · Date : ______

---

# PARTIE III — ARBITRAGE 2 : Module Opportunités

## Contexte
Ancienne vue : **colonnes par étapes** (kanban). EXD-04 : **cartes en lignes de 6**, groupes empilés. Processus Investally (vérifié) : cycle B2B long ; étapes *Prospection → RDV décideur → Offre → Accord de principe → Agrément → Inscrit Investudy* ; règle « RDV décideur avant accord de principe » (dérogation tracée) ; plusieurs opportunités par entreprise ; ≈ 20 utilisateurs, quelques dizaines à une centaine d'opportunités actives (H).

## Version actuelle — Vue en colonnes par étapes
| | |
|---|---|
| **Lisibilité** | Excellente pour **où en est le portefeuille** ; difficile de comparer des montants entre colonnes |
| **Scalabilité** | Moyenne : une colonne chargée devient longue ; au-delà de ~40 cartes, il faut filtrer |
| **UX** | Naturelle pour **faire avancer** (glisser d'une étape à l'autre) ; l'étape est visible sans lire |
| **Performance commerciale** | Révèle les **goulots** (trop de cartes en « Offre envoyée ») ; moins adaptée au tri par échéance |
| **Pertinence Investally** | **Forte** pour le suivi du processus et des règles d'étape ; faible pour comparer les montants |
| **Impacts techniques / maintenance** | Glisser-déposer à rendre **accessible au clavier** (coût) |

## Nouvelle version — Cartes en lignes de 6
| | |
|---|---|
| **Lisibilité** | Forte pour **comparer** (montants, responsables, prochaines actions) ; l'étape devient une étiquette (moins immédiate) |
| **Scalabilité** | Bonne jusqu'à ~60 cartes (10 lignes) ; au-delà : pagination, regroupement ou filtres |
| **UX** | Exploite bien la largeur d'écran ; sélection multiple et actions en lot **naturelles** ; peu adaptée pour faire avancer d'étape (menu ou fiche) |
| **Performance commerciale** | Bonne pour **prioriser** (tri par échéance ou montant) ; masque les goulots |
| **Pertinence Investally** | Bonne pour la **revue d'équipe** ; moins pour le suivi des étapes **réglementées** (règle du RDV décideur moins visible) |
| **Impacts techniques / maintenance** | Plus simple (pas de glisser-déposer) ; tri et filtres indispensables |

## Version hybride — **Une seule liste de données, deux présentations + bandeau d'étapes**
Trois composants combinables :
1. **Bandeau de synthèse** au-dessus : une pastille par étape avec son **nombre** et son **montant** ; un clic **filtre** (donne la vision « goulots » du kanban).
2. **Cartes par lignes de 6** (par défaut, comme demandé), **triables** (prochaine action, montant, étape).
3. **Bascule « Par étape »** (colonnes) pour faire avancer les opportunités ; la préférence est mémorisée.
| | |
|---|---|
| **Lisibilité** | **La plus forte** : synthèse + comparaison |
| **Scalabilité** | Bonne : le bandeau et les filtres absorbent la croissance |
| **UX** | Chaque tâche a sa vue ; léger risque de choix à faire pour l'utilisateur |
| **Performance commerciale** | **Meilleure** : priorisation **et** détection des goulots |
| **Pertinence Investally** | **Très forte** : respecte votre exigence, rend visibles les étapes réglementées |
| **Impacts techniques / maintenance** | Moyens : **un seul modèle de données**, deux rendus ; le prototype fait déjà la bascule |

## Grille comparative
| Critère (poids) | Colonnes | Cartes ×6 | **Hybride** |
|---|---|---|---|
| Valeur commerciale (5) | 4 | 3 | **5** |
| Lisibilité / comparaison (4) | 3 | 5 | **5** |
| Scalabilité (3) | 3 | 4 | **4** |
| Fidélité à EXD-04 (4) | 1 | 5 | **5** |
| Respect du processus et des règles d'étape (4) | 5 | 2 | **4** |
| Coût / maintenance (3) | 3 | 4 | **3** |
| Accessibilité (4) | 3 | 4 | **4** |
| **Score pondéré / 135** | **86** | **103** | **118** |

> **Recommandation** : **hybride** : cartes par défaut (votre exigence), bandeau d'étapes cliquable, bascule « Par étape ». Je proposerais de **mesurer** après deux semaines d'usage quelle vue est utilisée.
> **Décision** : ☐ Colonnes ☐ Cartes ×6 ☐ Hybride · Ordre des cartes : ______ · Date : ______

---

# PARTIE IV — ARBITRAGE 3 : Module Stocks

## Contexte
**Approvisionnements internes** d'Investally : articles, catégories, fournisseurs, entrées, sorties, inventaire, seuils, consommations internes. Faits : aucune relation avec les **clients** ni les opportunités ; **tous les employés** peuvent consommer, un petit nombre gère ; ADR-0005 sépare CRM et ERP (une base par produit, événements, aucun paquet partagé avant l'ERP) ; **l'ERP n'existe pas encore**, son socle (identité unique, paquets partagés) est à construire.

## Option 1 — Stocks intégrés au **CRM**
| | |
|---|---|
| **Avantages** | **Le plus rapide** : identité, droits, audit, interface et recette existent ; livrable en quelques sprints |
| **Inconvénients** | **Pollue le périmètre du CRM** (clients, pipeline, formation) ; contredit l'esprit d'ADR-0005 ; couple les cycles de livraison ; migration future coûteuse |
| **Impacts métier** | Les stocks se retrouvent dans un outil « commercial » ; incohérence pour la finance (valorisation, achats) |
| **Impacts techniques** | Schéma dans la base du CRM ; **migration vers l'ERP à prévoir** (🔴) |
| **Impacts organisationnels** | Propriétaire flou ; droits Stocks mêlés aux rôles commerciaux |
| **Impacts maintenance** | Dette de **déménagement** certaine |
| Réversibilité | 🔴 |

## Option 2 — Stocks intégrés à l'**ERP**
| | |
|---|---|
| **Avantages** | **Cohérence métier** : « Opérations » (achats, finance, stocks) au même endroit ; respecte ADR-0005 ; pas de déménagement |
| **Inconvénients** | **Attend l'ERP** (socle d'identité, paquets partagés) : plusieurs sprints avant la première ligne de stock ; risque de ne jamais commencer |
| **Impacts métier** | Besoin réel (approvisionnement interne) satisfait **tard** |
| **Impacts techniques** | Propre, mais **dépend de chantiers non commencés** |
| **Impacts organisationnels** | Responsable naturel : opérations / finance |
| **Impacts maintenance** | Faible une fois posé |
| Réversibilité | 🟡 |

## Option 3 — **Module indépendant partagé**
Un contexte `stock` autonome, utilisable par le CRM comme par l'ERP.
| | |
|---|---|
| **Avantages** | Découplé ; réutilisable ; **évolue vers un service** |
| **Inconvénients** | Si on en fait un **service séparé** dès maintenant : déploiement, authentification inter-services, observabilité… **disproportionné** pour 20 utilisateurs |
| **Impacts métier** | Bon si le besoin dépasse un produit (H : c'est probable) |
| **Impacts techniques** | Lourds s'il est déployé à part ; légers s'il reste un **module** |
| **Impacts organisationnels** | Propriétaire explicite |
| **Impacts maintenance** | Moyens |
| Réversibilité | 🟡 |

### Variante recommandée « 3′ » — **Module autonome, hébergé dans le monolithe du CRM, conçu pour être extrait**
Un contexte `stock` avec son **propre schéma** (`stock`), **aucune dépendance vers les modules du CRM** (uniquement l'identité, l'audit et les droits via leurs interfaces publiques), échanges par **événements**, interface en **section « Opérations »** ; il s'extrait vers l'ERP (ou un service) **sans réécriture** quand l'ERP existera.
| | |
|---|---|
| **Avantages** | **Livrable tôt** (socle réutilisé) **et** propre ; extraction planifiée ; respecte l'intention d'ADR-0005 (frontières nettes) |
| **Inconvénients** | Exige de la **discipline de frontière** (règles d'architecture automatiques déjà en place) ; un **ADR dérogatoire** doit documenter l'hébergement provisoire |
| Réversibilité | 🟢 à 🟡 |

## Grille comparative
| Critère (poids) | 1 CRM | 2 ERP | 3 Service indépendant | **3′ Module autonome hébergé** |
|---|---|---|---|---|
| Valeur métier / délai (5) | 5 | 1 | 2 | **4** |
| Cohérence d'architecture (4) | 1 | 5 | 4 | **4** |
| Réversibilité (4) | 1 | 3 | 3 | **4** |
| Coût de réalisation (3) | 5 | 2 | 1 | **4** |
| Maintenance (3) | 2 | 4 | 3 | **4** |
| Risque (5) | 3 | 3 | 2 | **4** |
| Organisation / propriété (2) | 2 | 4 | 4 | **4** |
| **Score pondéré / 130** | **73** | **78** | **68** | **104** |

> **Recommandation** : **3′**. Elle évite le piège du CRM « fourre-tout » **sans** attendre l'ERP ni payer le coût d'un service séparé.
> **Conditions** : ADR dérogatoire ; règle d'architecture interdisant à `stock` d'importer un module du CRM ; permissions `stock.*` propres ; rôle dédié (Logistique) à confirmer ; **mouvements immuables** comme l'audit.
> **Ce qui me ferait changer d'avis** : si l'ERP est décidé **avant** la fin de S4, l'option 2 devient préférable.
> **Décision** : ☐ 1 CRM ☐ 2 ERP ☐ 3 service ☐ 3′ module autonome · Date : ______

---

# PARTIE V — ARBITRAGE 4 : Ordre de réalisation

## Contexte
Ordre proposé : **1 Habillage UX/UI → 2 Authentification → 3 S4 → 4 Reporting → 5 Stocks**. Éléments à intégrer : S3.4 et S3.5 non validés ; **S3.6 Documents** (pièces jointes) ; **Microsoft 365** et SuperAdmin (bloquants réels) ; avis juridique sur les performances ; cadrage UX avant S4.1.

## Option proposée (analyse)
| Étape | Risques | Dépendances | Valeur métier | Rapidité |
|---|---|---|---|---|
| 1 Habillage | Aucune valeur métier visible pendant plusieurs semaines ; risque de **« poli sans fond »** | Validation S3.4/S3.5 (le front y vit) ; logos SVG | Moyenne (image, confiance) | Rapide (3 sprints courts) |
| 2 Authentification | Faible ; **historique des connexions** demande un petit développement d'API | Habillage (gabarits) ; **Microsoft 365** pour les e-mails réels | Élevée pour la **sécurité** et l'adoption | Rapide (déjà à moitié fait) |
| 3 S4 | Le **cœur métier** ; règles d'agrément floues | Cadrage UX ; Documents ; réponses sur l'agrément | **Très élevée** | Long (4 sprints+) |
| 4 Reporting | Dépend des **données de S4** ; sujet juridique (performances) | S4, S5/S6 pour les indicateurs | Moyenne à élevée | Moyen |
| 5 Stocks | Besoin réel mais **isolé** | Socle ; décision d'architecture | Moyenne | Moyen |
**Points faibles** : (a) il **ignore les prérequis** (validations, M365, Documents) ; (b) la valeur commerciale n'arrive qu'à l'étape 3 ; (c) tout l'habillage en un bloc retarde S4.

## Ordre alternatif 1 — **Valeur et prérequis d'abord**
| Ordre | Contenu |
|---|---|
| **0** | **Valider S3.4/S3.5** ; débloquer **Microsoft 365**, **deux SuperAdmin**, lancer l'avis juridique (en parallèle) |
| 1 | **H1 minimal** : jetons, polices, logos, coque + **hub et rail** (décision navigation) |
| 2 | **H2 authentification complète + sessions** (+ endpoint d'historique) |
| 3 | **S3.6 Documents** (prérequis des pièces jointes) |
| 4 | **Cadrage UX court** (5 écrans, à partir des prototypes) |
| 5 | **S4.1 → S4.4** (+ **Agenda S4.2b**), chaque écran **né dans le nouveau style** (pas de H3 séparé) |
| 6 | **Reporting** : d'abord **incidents** (valeur immédiate, léger), puis rapports périodiques ; **performances en dernier, après avis juridique** |
| 7 | **Stocks** (module autonome, ou ERP-0) |

## Ordre alternatif 2 — **Valeur métier d'abord**
S4 avant tout habillage, puis restyler. **Avantage** : valeur commerciale plus tôt. **Défaut majeur** : **coder deux fois** les écrans du pipeline (style actuel puis nouveau) ; incohérence visible ; je le déconseille.

## Ordre alternatif 3 — **Parallèle limité**
Habillage et S4 en parallèle. **Avantage** : débit. **Défaut** : équipe de deux, conflits de fichiers, validations croisées ; risque d'erreurs de coordination.

## Grille comparative
| Critère (poids) | Proposé | **Alt. 1** | Alt. 2 | Alt. 3 |
|---|---|---|---|---|
| Valeur métier précoce (5) | 2 | **4** | 5 | 4 |
| Risque et dépendances traités (5) | 2 | **5** | 2 | 3 |
| Cohérence visuelle (3) | 5 | **5** | 1 | 4 |
| Coût total / refaire (4) | 3 | **5** | 1 | 3 |
| Rapidité de la première valeur visible (3) | 3 | **4** | 5 | 4 |
| Charge de coordination (3) | 4 | **4** | 4 | 1 |
| **Score pondéré / 115** | **68** | **104** | **69** | **74** |

> **Recommandation** : **ordre alternatif 1** : il garde votre ordre (habillage → authentification → S4 → reporting → stocks) et y **insère les prérequis** et **supprime le H3 séparé**.
> **Décision** : ☐ Proposé ☐ Alt. 1 ☐ Alt. 2 ☐ Alt. 3 · Date : ______

---

# PARTIE VI — Décision finale

## Décisions recommandées
| # | Sujet | Recommandation |
|---|---|---|
| 1 | Versionnement design | **Option D** (Git + releases sémantiques + journal et fiches de décision) |
| 2 | Navigation | **B+** : rail compact par défaut hors du hub, bouton « Déplier » |
| 3 | Opportunités | **Hybride** : cartes par défaut, bandeau d'étapes, bascule « Par étape » |
| 4 | Stocks | **3′** : module autonome hébergé dans le monolithe, conçu pour être extrait |
| 5 | Ordre | **Alternatif 1** : prérequis d'abord, H1 minimal, authentification, Documents, S4 dans le nouveau style, Reporting (incidents d'abord), Stocks |
| 6 | Performances des employés | **Après avis juridique et RH**, avec transparence pour l'employé |
| 7 | Méthode | Appliquer cette **méthode d'arbitrage** à toute décision structurante |

## Décisions déconseillées
| Option | Pourquoi |
|---|---|
| Versionnement **par copies de dossiers** (A) | Duplication, aucune comparaison lisible, dérive |
| Navigation **sans rail** hors du hub (A, stricte) | Coût de productivité et d'accessibilité mesurable |
| Opportunités **cartes seules** ou **kanban seul** | Chacun perd la moitié de l'usage (comparaison ou suivi d'étape) |
| Stocks **directement dans le CRM sans frontière** (option 1 nue) | Dette de déménagement **🔴** ; contredit ADR-0005 |
| Stocks en **service séparé dès maintenant** | Disproportionné pour ≈ 20 utilisateurs |
| **S4 avant l'habillage** (alt. 2) | Écrans codés deux fois |
| Construire le **suivi de performance** sans avis juridique | Risque de conformité et de confiance interne |

## Risques
| # | Risque | Prob. | Impact | Parade |
|---|---|---|---|---|
| 1 | Microsoft 365 non fourni : e-mails réels impossibles (invitations, mot de passe oublié) | Certaine | **Élevé** | Traiter **avant** tout usage réel |
| 2 | Périmètre qui **gonfle** (44 écrans, 2 contextes) sans date de fin | Élevée | Élevé | Prioriser par valeur ; un parcours par module d'abord |
| 3 | Habillage perçu comme « du vernis » sans valeur métier | Moyenne | Moyen | H1 minimal ; style appliqué **en même temps** que S4 |
| 4 | Données de performance mal encadrées | Moyenne | Élevé (conformité) | Avis juridique, transparence, accès limité |
| 5 | Stocks hébergés provisoirement **jamais extraits** | Moyenne | Moyen | Règle d'architecture automatique + ADR avec échéance |
| 6 | Versionnement non tenu par manque de discipline | Moyenne | Moyen | Automatiser les instantanés ; une règle de « Je valide » |
| 7 | Rail compact mal compris | Faible | Moyen | Essai avec 3 utilisateurs ; bouton Déplier |

## Dette technique induite
| Dette | Origine | Remboursement |
|---|---|---|
| Hébergement provisoire de Stocks dans le monolithe | Option 3′ | Extraction vers l'ERP/service (ADR avec échéance) |
| Deux modes de coque (hub, rail) | Navigation B+ | Un seul composant à deux états ; tests de focus |
| Vue « Par étape » à rendre accessible au clavier | Hybride Opportunités | Alternative clavier (menu « Déplacer vers… ») |
| Instantanés visuels dans le dépôt | Versionnement D | Sortir du dépôt au-delà d'une trentaine de versions |
| Index de recherche par module | Hub et recherche globale | À maintenir à chaque nouveau module |
| Historique des connexions : nouvel endpoint | Écrans d'authentification | Petit développement d'API (S3.x) |

## Priorité
| Décision | Priorité |
|---|---|
| Valider S3.4/S3.5, débloquer Microsoft 365 et les SuperAdmin | **Haute** |
| Ordre de réalisation (alt. 1) | **Haute** |
| Navigation (B+) | **Haute** (conditionne H1) |
| Opportunités (hybride) | **Moyenne** (avant S4.3) |
| Versionnement design (D) | **Moyenne** (à poser avant de multiplier les versions) |
| Stocks (3′) | **Moyenne** (avant la phase ERP) |
| Performances des employés | **Faible** pour le calendrier, **Haute** pour le cadrage juridique |

## Recommandation finale globale
**En tant qu'architecte produit de la plateforme Investally, je choisirais** la combinaison suivante : **versionnement D**, **navigation B+**, **Opportunités hybrides**, **Stocks en module autonome (3′)** et **l'ordre alternatif 1**.
**Pourquoi** : c'est la combinaison qui **protège ce qui est déjà solide** (socle d'accès, règles d'architecture), **livre la valeur commerciale le plus tôt possible sans coder deux fois**, et **garde chaque décision réversible**. Les choix les plus coûteux à défaire (rattachement des Stocks, données de performance) sont traités avec des **garde-fous explicites** plutôt qu'avec de la vitesse. Le prochain geste utile n'est **pas** d'implémenter : c'est de **valider S3.4 et S3.5** et de **débloquer Microsoft 365 et les SuperAdmin**.

> **Rappel** : ces recommandations n'engagent aucune réalisation. **La décision appartient à la direction produit** ; chaque case « Décision » ci-dessus est à compléter, puis je les consignerai dans le registre des décisions et mettrai les documents à jour.

---

# Annexe — Journal de décision (à compléter)
| N° | Sujet | Option retenue | Date | Motif / réserves |
|---|---|---|---|---|
| DEC-001 | Versionnement des livrables design | | | |
| DEC-002 | Navigation globale (EXD-05) | | | |
| DEC-003 | Module Opportunités | | | |
| DEC-004 | Rattachement du module Stocks | | | |
| DEC-005 | Ordre de réalisation | | | |
| DEC-006 | Données de performance des employés | | | |
