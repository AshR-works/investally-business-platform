# Fiche de test — Correctifs de recette n° 1 : téléphones, fenêtres, barres de défilement, tableaux

| | |
|---|---|
| **Session** | `correctifs-1` |
| **Recette de référence** | [`SPRINT-CORRECTIFS-1-RECETTE.md`](../../SPRINT-CORRECTIFS-1-RECETTE.md) |
| **Étiquette** | — |
| **Contexte** | Branche `fix/telephone-fenetres-tableaux` (partie de `main`, après S4.4b) · 2026-11-03 · observations de recette 1 et 2 (`docs/cadrages/OBSERVATIONS-VALIDATION-UX-ET-DONNEES-DE-TEST.md`) et deux demandes du Responsable produit : symbole de tri des tableaux, barres de défilement minimalistes, largeurs de colonnes fixes. Aucun changement d'architecture ni de droits. |
| **Écrans concernés** | [Entreprises (tableau)](../interfaces/10-entreprises.md), [Fiche d'une entreprise](../interfaces/11-fiche-entreprise.md), [Contacts](../interfaces/12-contacts.md), [Ambassadeurs](../interfaces/17-ambassadeurs.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi. Elle sert à rejouer la recette utilisateur et à vérifier l'absence de régression.*

## Avant de commencer
- Pile locale lancée (`node scripts/local-stack.mjs --demo`) ou pile jetable ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : chargé de compte, Responsable commercial (avec son équipe), Direction, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Téléphones : une règle unique | Seuls les **chiffres, les espaces et un « + » en première position** sont acceptés ; le **premier chiffre** (après le « + ») n'est **pas 0** ; de **8 à 15 chiffres**. Les espaces se saisissent librement et sont **retirés à l'enregistrement** (`+237699123456`). Messages précis (caractère interdit, « + » mal placé, commence par 0, trop long, trop court). Une seule fonction côté serveur (contact, entreprise, … | ☐ | |
| 2 | Téléphones : interface | Aide dans chaque libellé (« avec l'indicatif du pays, ex. +237 699 12 34 56 »), clavier numérique, messages identiques à ceux du serveur ; le champ n'est jamais bloqué à la frappe | ☐ | |
| 3 | Téléphones : base de données | Migration `20261110000000_phone_format` : nettoie la forme des numéros existants (séparateurs retirés **seulement si le résultat respecte la règle** ; aucune valeur n'est effacée), puis une contrainte sur les quatre tables (entreprises, contacts, facilitateurs, ambassadeurs) refuse toute écriture non conforme | ☐ | |
| 4 | Fenêtres : barre de défilement | La barre ne déborde plus sur les angles arrondis : le **cadre ne défile plus**, l'**en-tête reste en place**, seul le **corps défile**, barre à l'intérieur du cadre avec des marges ; la place de la barre est réservée (la largeur ne saute pas) ; les boutons **« Retour / Enregistrer » restent visibles en bas**, sans défiler. Un seul composant et un seul endroit de style : toutes les fenêtres (35) | ☐ | |
| 5 | Barres de défilement minimalistes | Sur **toute l'application** : fines, sans rail ni flèches, pouce arrondi discret qui se renforce au survol ; couleurs dérivées du texte (thèmes clair et sombre) ; repli pour les navigateurs sans cette fonction | ☐ | |
| 6 | Tableaux : symbole de tri | Les symboles de texte ↕ ▲ ▼ sont remplacés par des **pictogrammes** du jeu d'icônes (deux chevrons, flèche vers le haut, flèche vers le bas) ; l'icône du tri actif est colorée, les autres sont atténuées jusqu'au survol ; l'emplacement de l'icône est de **taille fixe** | ☐ | |
| 7 | Tableaux : largeurs fixes | Les neuf tableaux (entreprises, contacts, ambassadeurs, offres, relances, utilisateurs, documents, sessions, historique de connexion) ont des **largeurs de colonnes fixes** : chaque colonne garde sa part du tableau quel que soit son contenu ; **trier ou changer de page ne déplace plus aucune colonne** ; textes longs coupés plutôt que débordants ; largeur minimale de 48 rem (défilement horizontal en dernier recours) | ☐ | |

## Preuves automatisées relevées à la validation
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation |
| Tests unitaires de l'API | **879 réussis**, 1 ignoré (les suites d'intégration sont ignorées dans cette passe) ; 24 nouveaux (la règle de téléphone : 8 numéros valides, 14 invalides, vides, motif de la base) |
| **Tests d'intégration (PostgreSQL jetable)** | **349 / 349** (24 suites) ; 1 nouveau de bout en bout (numéro enregistré sans espace, six refus, deux acceptations, **écritures directes refusées par la base** pour les contacts et les entreprises) |
| Tests de l'interface | **499 / 499** (41 nouveaux) : règle de téléphone rejouée sur le même jeu d'essai que le serveur (**cohérence avec le domaine réel**, décision et message), formulaires contact et ambassadeur, structure des fenêtres, barres de défilement, icônes de tri, largeurs de colonnes (calcul des parts) |
| **Mutants** | **24 / 24 tués** (règle de téléphone côté serveur et côté interface, nettoyage, règle de la base, tableau : symboles, mise en page fixe, icône, parts des colonnes, marge de la case ; fenêtre : cadre, place de la barre, boutons collés, corps ; barres de défilement) ; script `scripts/mutants/correctifs-recette-1.py`. **Un survivant a été trouvé puis éliminé** : le calcul des parts de colonnes n'était vérifié que par une recherche dans le code ; il est maintenant une fonction testée (`lib/table-layout.ts`) |
| **Navigateur réel (Edge + axe-core)** | **Parcours ciblé** (connexion, entreprise, agréments, ambassadeurs) : **65 contrôles réussis, 0 violation** sur 31 écrans audités. Contrôles ajoutés : la fenêtre « Nouvelle entreprise » à **320, 375, 768 et 1280 px** (aucun débordement horizontal, cadre fixe, boutons visibles, barre dans le cadre) ; le tri d'un tableau : **colonnes de même largeur au pixel près** avant et après chaque tri (77, 237, 142, 118, 142, 154, 118, 106 px), tableau de même largeur, en-têtes de même hauteur, sens annoncé qui change, pictogrammes présents et plus aucun symbole de texte ; barres de défilement fines. Le … |

## Réserves, limites et dette connues
- Des tests existants attendaient les numéros **avec leurs espaces** : adaptés à la forme enregistrée (sans espace).
- Un survivant de mutant (parts de colonnes), voir plus haut.
- Trois **courses du script d'audit** (jamais du produit) corrigées : attente d'un chargement fini avant de lire la première ligne du tableau des ambassadeurs, avant de lire le panneau Agréments vide, et numéros attendus sans espace. Une passe a aussi été perdue par la disparition du dossier de build du serveur web de test (incident d'environnement).
- **Parcours navigateur ciblé** : seules la fiche entreprise et ses panneaux, les agréments et les ambassadeurs sont parcourus ; les autres tableaux (contacts, offres, relances, utilisateurs, documents, sessions) **ne sont pas ouverts dans le navigateur**. Leurs largeurs sont couvertes par le composant commun et par des tests, mais **leur rendu visuel est à vérifier à l'œil** (poids des colonnes choisis à partir de leur contenu type).
- **Six captures d'écran n'ont pas été produites** (le navigateur sans fenêtre ne répond pas à la capture), sans effet sur les contrôles.
- **Les fenêtres autres que « Nouvelle entreprise » ne sont pas mesurées aux quatre largeurs** : elles partagent le même composant et le même style, mais seule cette fenêtre est contrôlée dans le navigateur.
- **Données existantes** : la contrainte de téléphone est posée en mode « écritures nouvelles seulement » : une ligne ancienne non conforme (par exemple un numéro commençant par 0) n'est **pas modifiée** mais **ne pourra plus être mise à jour** (même pour un autre champ, par exemple le statut) tant que son numéro n'est pas corrigé. La migration décrit la requête qui les liste. Aucune donnée de production n'existe à ce jour.
- Les largeurs de colonnes sont des **valeurs par défaut** (à ajuster après regard sur de vraies données).
- La **vidéo** jointe à la demande n'a pas pu être lue (format non pris en charge dans l'environnement) : les corrections s'appuient sur les captures d'écran et sur le code.
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22.
- **Q1 à Q4 du document d'observations** : premier chiffre non nul après le « + », minimum de 8 chiffres, forme enregistrée sans espace, contrainte en base : **valeurs par défaut appliquées, à confirmer**.
- **D130** (`docs/TECH-DEBT.md`) : lignes anciennes non conformes à corriger puis contrainte à valider (`VALIDATE CONSTRAINT`) ; **D131** : poids de colonnes à ajuster sur de vraies données ; **D132** : fenêtres à mesurer toutes aux quatre largeurs.

## Rejouer les contrôles automatisés
```bash
pnpm ci                                   # types, architecture, tests unitaires et interface
node apps/crm-api/scripts/test-db.mjs     # tests d'intégration (base PostgreSQL jetable)
python scripts/mutants/correctifs-recette-1.py   # mutants du lot (arbre de travail propre)
```

## Écarts constatés
| Date | Vérification n° | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
