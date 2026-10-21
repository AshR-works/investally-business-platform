# Livrables UX/UI — mode d'emploi

**Version courante** : voir [`VERSION`](VERSION) (**0.4.1**, statut *Validée*) · **Gouvernance** : décision DEC-001, option D (Git + releases sémantiques + journal et fiches de décision).

## Où est quoi
| Dossier / fichier | Rôle |
|---|---|
| `01-DESIGN-SYSTEM.md`, `02-SPECIFICATIONS-FRONTEND.md`, `04-ANALYSE-D-IMPACT.md`, `05-AIDE-A-LA-DECISION.md` | Documents **vivants** (versionnés par Git) |
| `exigences/REGISTRE-EXD.md` | Exigences de conception obligatoires (EXD), jamais effacées |
| `decisions/` | **Fiches de décision de design (DDR)** : le *pourquoi* de chaque choix, avec la version et les exigences concernées |
| `prototype/` | Source vivante du prototype (HTML, CSS, JS, jetons, polices, logos) |
| `screens/` | Derniers rendus (clair et sombre) |
| `releases/` | **Instantanés figés** des versions (captures, manifeste d'empreintes, notes) et `index.json` |
| `outils/` | `render-screens.mjs` (captures), `release.mjs` (figer une version), `compare.html` (comparer) |
| `CHANGELOG-DESIGN.md` | « Quoi de neuf », version par version, en langage clair |

## Numérotation
`MAJEUR.MINEUR.CORRECTIF` — **MAJEUR** : rupture visuelle ou de navigation · **MINEUR** : nouveaux écrans ou composants · **CORRECTIF** : retouches sans changement de sens.
Cycle d'une version : **Proposée → En revue → Validée (par la direction produit) → Figée**. Une version n'est **étiquetée** qu'une fois validée (exception : les versions **reconstituées** v0.1.0 à v0.3.0 portent une étiquette de reconstitution pour permettre les comparaisons Git).

## Les cinq gestes
| Je veux… | Commande |
|---|---|
| **Régénérer les captures** | `node docs/design/outils/render-screens.mjs` |
| **Figer une version** | `node docs/design/outils/release.mjs --version 0.5.0 --status "En revue"` |
| **Étiqueter après validation** | `git tag -a design-v0.5.0 <commit> -m "Design v0.5.0"` (la commande exacte est affichée par `release.mjs`) |
| **Comparer deux versions** | Texte : `git diff design-v0.3.0 design-v0.4.0 -- docs/design` · Visuel : `cd docs/design && python -m http.server 8099` puis `http://127.0.0.1:8099/outils/compare.html?a=0.3.0&b=0.4.0` |
| **Revenir à une version** | Consulter : `git checkout design-v0.3.0 -- docs/design` · Annuler de façon tracée : `git revert <commit>` (**jamais** de réécriture d'historique) |

## Règles
1. Toute évolution significative **cite** l'exigence EXD ou la décision DEC/DDR qui la justifie.
2. Toute décision de design a **sa fiche DDR** (statut : proposée, acceptée, remplacée, rejetée) ; une décision n'est jamais effacée.
3. Une version contient : captures figées, manifeste (empreintes SHA-256), notes ; le tout est relu avant validation.
4. Les instantanés pèsent ≈ 2 à 3 Mo par version : au-delà d'une trentaine de versions, on les sort du dépôt (dette connue, voir `05-AIDE-A-LA-DECISION.md`).
5. Les versions **reconstituées** (v0.1.0 à v0.3.0) le sont à partir des commits d'origine ; leur manifeste l'indique.

## Versions
| Version | Statut | Commit | Contenu |
|---|---|---|---|
| 0.1.0 | Proposée (reconstituée) | `35d4abf` | Premier design system et prototype, logos fournis |
| 0.2.0 | Proposée (reconstituée) | `1687304` | + Espace agenda, tous les écrans en clair et en sombre |
| 0.3.0 | Proposée (reconstituée) | `0b72ce4` | + Exigences EXD-01 à 04 (panneau, sélection persistante, Opportunités en cartes) |
| **0.4.0** | **En revue** | *(voir `releases/v0.4.0/MANIFEST.md`)* | + Décisions DEC-002 et DEC-003 (navigation B+, Opportunités hybrides), hub et recherche globale, gouvernance |
| **0.4.1** | **Validée** | *(voir `releases/v0.4.1/MANIFEST.md`)* | + Panneau principal centré (DEC-007, option B), bouton de dépliage en pictogramme (EXD-10, EXD-11) |
