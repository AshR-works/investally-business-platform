# Wireframes de l'application

**45 écrans** : 12 déjà réalisés (repris pour référence) et **33 proposés** pour les interfaces qui ne sont pas encore prêtes. Ouvrir [`index.html`](index.html) pour la galerie (filtre par module) ou lire le [catalogue](CATALOGUE.md).

> Statut : **propositions à valider** par la direction produit. Aucun écran proposé n'est une décision : chaque écran liste ses points à trancher dans ses annotations.

## À quoi servent ces wireframes
- Fixer **la structure et le contenu** de chaque écran : ce qu'on voit d'abord, les actions, les données, les états.
- Montrer **les droits** : ce que chaque rôle voit, et ce qui est masqué quand le droit manque.
- Servir de **base de travail** au graphiste (maquettes haute fidélité et prototypage sur Figma) et de **point de départ aux cas d'usage et aux workflows**.
- Ils sont volontairement en **niveaux de gris** : le style (taupe, polices, contrastes) est celui du design validé (v0.4.1), appliqué ensuite écran par écran sur Figma.

## Comment lire un wireframe
| Élément | Sens |
|---|---|
| **Colonne de droite** | Module, état (**Livré** ou **Proposé**), sprint prévu, vue pour quel rôle, droits nécessaires |
| **Pastilles orange numérotées** | Annotations : règle métier, droit, point à trancher |
| **États à concevoir** | Chargement, vide, erreur, droits réduits, thème sombre, petit écran, et les cas propres à l'écran |
| **Rail de gauche** | Modules de l'application ; le module actif est encadré |
| **Fenêtre grisée** | Écran affiché dans une fenêtre (croix en haut à droite, EXD-15) |

## Les écrans
| Module | Écrans |
|---|---|
| Accès (livré) | Connexion, second facteur, mon compte |
| Vue d'ensemble (livré) | Hub |
| Business Development | Entreprises (liste, fiche, création), **fiche 360°**, contacts, offres, décharge, relances, **agenda**, rendez-vous, **opportunités** (cartes et par étape), dérogation, **agrément**, ambassadeurs, **commissions à verser** |
| Investudy | Catalogue, sessions, détail d'une session, apprenants, inscription, présences, certifications |
| Reporting | Tableaux de bord (chargé de compte, Responsable commercial, Direction, Investudy), **rapports des employés (vue partagée)**, incidents |
| Stocks | Articles et seuils, mouvements et inventaire |
| Finance | Factures, **document de facture (charte)** |
| RH et fiscalité | Congés, échéances fiscales |
| Administration | Utilisateurs, rôles, **journal d'audit** |

## Points ouverts qui reviennent dans les annotations
- **Vues partagées** (rapports des employés, agendas) : audience à définir, contenu sensible à valider avec le juridique et les RH (D60).
- **Suivi des versements de commission** : états et justificatif à préciser avec le DAF (D54).
- **Agrément** : places ou somme globale, payeur tiers, expiration (questions ouvertes de l'architecture).
- **Documents officiels** : mentions légales, numérotation et TVA à confirmer avec le DAF avant d'émettre un vrai document.
- **Alternative clavier** de la vue « Par étape » des opportunités (dette D30).

## Regénérer ou modifier
Les SVG sont **générés** : ne pas les modifier à la main.
1. Modifier `screens.mjs` (un objet par écran : blocs, annotations, états).
2. Lancer, depuis la racine du dépôt :

```bash
node docs/design/wireframe/build.mjs
```

Cela réécrit `svg/`, `index.html` et `CATALOGUE.md`. Aucune dépendance à installer.

## Suite prévue
Les cas d'usage et les workflows de l'application, à partir de ces écrans.
