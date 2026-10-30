# Brief de design Figma — écrans de S4 (cadrage UX)

**Date** : 2026-10-29 · **Statut** : **proposition à valider** · **Suite de** : [CADRAGE-UX-5-ECRANS-CLES.md](CADRAGE-UX-5-ECRANS-CLES.md) (atelier d'environ 90 minutes décidé le 2026-10-21)

> Objet : donner au graphiste, qui produit les **maquettes haute fidélité et le prototypage sur Figma**, et à l'atelier de cadrage, ce que chaque écran doit contenir, quels **droits** changent ce que l'on voit, et ce qui reste à trancher. Aucune décision n'est prise ici : les points marqués **« à trancher »** sont ceux de la direction produit.

## 1. Règles communes à tous les écrans
- **Style validé** : design v0.4.1 (taupe, contrastes, polices hébergées, thèmes clair et sombre). On ne redessine pas : on décline. Les composants déjà réalisés dans l'application sont à **réutiliser** : coque et navigation (hub, rail), page d'en-tête, carte, tableau de données (recherche, pagination, sélection persistante), badge d'état, fenêtre (normale ou large), confirmation d'action irréversible.
- **Exigences à respecter** (`docs/design/exigences/REGISTRE-EXD.md`) : EXD-01 profondeur de la zone principale, EXD-02 sélection persistante, EXD-04 opportunités en cartes par 6, EXD-10 panneau centré, EXD-11 bouton de dépliage, EXD-12 mot de passe affichable, EXD-13 actions irréversibles confirmées, EXD-14 droits visibles.
- **Accessibilité (WCAG 2.2 AA)** : tout se fait au **clavier** ; l'état n'est jamais porté par la couleur seule (texte ou pictogramme en plus) ; les erreurs sont annoncées et listées ; contrastes mesurés. Pour chaque écran, **toute interaction à la souris (glisser-déposer, survol) a une alternative clavier** (dette D30).
- **Chaque écran est livré dans tous ses états** : chargement, vide, erreur, résultat, **droits réduits** (ce que voit un profil qui n'a que « ses propres » données), thème clair et sombre, largeur 1280 px et en dessous de 1024 px.
- **Les droits décident de l'affichage** : l'interface masque ce qui n'est pas accordé, mais le serveur reste le seul juge. Trois portées : **Propre** (ses objets), **Équipe** (lui et ses subordonnés directs), **Tous**.
- **Libellés en français métier**, ceux que les équipes emploient réellement (à confirmer en atelier).

## 2. Les cinq écrans

### Écran 1 — Fiche entreprise (vue 360°)
| | |
|---|---|
| **Rôle** | Voir d'un coup d'œil où en est une entreprise et agir sans quitter la fiche |
| **Déjà livré** | Identité (statut, secteur, pays, e-mail, téléphone), bloc « Mise en relation » (facilitateur, méthode de contact, commission selon les droits), documents versionnés |
| **À ajouter (S4.1 et suivants)** | Contacts, offres et décharges, rendez-vous, opportunités, historique des actions |
| **Statuts de l'entreprise** | Cible, Contactée, Qualifiée, Cliente, Archivée |
| **Premier regard** | Nom, statut, propriétaire, prochaine action, opportunités en cours |
| **Droits** | Entreprise : `bd.company.read` (Propre, Équipe ou Tous). **Commission : visible seulement avec `bd.commission.read`** (chargé de compte sur ses entreprises, Responsable commercial sur son équipe, Direction, Finance). Un facilitateur hors portée n'est pas affiché |
| **À trancher** | Organisation de la page (onglets, sections continues ou colonnes) ; ce qui est « premier regard » et ce qui est secondaire |

### Écran 2 — Création et modification d'une entreprise et d'un contact
| | |
|---|---|
| **Déjà livré** | Création d'entreprise : nom (obligatoire), secteur, e-mail, téléphone, puis « Mise en relation » (nouveau facilitateur ou facilitateur enregistré, méthode de contact, « employé de l'entreprise », commission en montant fixe ou pourcentage, devise XAF/FCFA par défaut). Contrôles avant envoi, messages annoncés |
| **À concevoir** | **Modification** d'une entreprise ; **création et modification d'un contact** (interlocuteur : DAF, décideur…) ; gestion des **doublons** (le nom d'entreprise est déjà unique, sans tenir compte de la casse) |
| **Données d'un contact (hypothèse)** | Nom, prénom, fonction ou type (DAF, décideur, autre), e-mail, téléphone, entreprise liée |
| **Droits** | `bd.company.create/update`, `bd.contact.create/update` ; commission : `bd.commission.manage` (Responsable commercial et Super administrateur seulement) |
| **À trancher** | Fenêtre ou page pour chaque formulaire ; champs d'un contact ; que faire à la détection d'un doublon (bloquer, proposer la fiche existante) |

### Écran 3 — Offres, décharges et relances
| | |
|---|---|
| **Rôle** | Suivre une offre déposée, sa décharge signée et les relances planifiées |
| **Règles métier** | Une seule décharge valide par offre ; pas de relance après une décharge refusée ou une offre retirée ; seules les transitions d'état permises sont proposées |
| **Droits** | `bd.offer.*`, `bd.receipt.*`, `bd.followup.*` (Propre pour le chargé de compte, Équipe pour le Responsable commercial) |
| **À trancher** | États exacts d'une offre ; relances : liste, calendrier ou les deux ; alerte sur une relance en retard |

### Écran 4 — Opportunités
| | |
|---|---|
| **Déjà décidé (DEC-003)** | Hybride : **cartes par lignes de 6** par défaut, bandeau d'étapes, bascule « Par étape » ; prototype v0.4.0 |
| **Règle métier** | Pas d'« accord de principe » sans au moins un rendez-vous décideur tenu ; **dérogation possible du Responsable commercial, avec justification obligatoire et auditée** (à concevoir : la fenêtre de dérogation). Une entreprise peut avoir plusieurs opportunités ; une opportunité clôturée n'est plus modifiable |
| **Droits** | `bd.opportunity.*` ; lecture élargie pour le Responsable commercial et la Direction |
| **À concevoir** | **Alternative clavier** de la bascule « Par étape » (dette D30) ; sélection persistante |
| **À trancher** | Informations sur la carte ; filtres ; mesure d'usage prévue après deux semaines |

### Écran 5 — Agenda
| | |
|---|---|
| **Rôle** | Voir et créer rendez-vous, relances, formations et échéances |
| **Prévu (S4.2b)** | Vues semaine, mois et jour ; rappels ; création liée à une entreprise ou une opportunité ; droits Propre, Équipe, Tous |
| **Droits** | Ce que l'on voit dépend de la portée : le chargé de compte voit son agenda, le Responsable commercial celui de son équipe |
| **À trancher** | Vue par défaut ; affichage d'un agenda d'équipe ; conflits d'horaire |

## 3. Écran ajouté à l'ordre du jour : versement des commissions
Le **chargé de compte verse la commission** après que la direction administrative et financière a débloqué les fonds (décision du 2026-10-29, dette D54). Cela appelle un écran de suivi, absent du plan initial :

| | |
|---|---|
| **États envisagés (hypothèse)** | À verser → fonds débloqués → versée (avec date) |
| **Qui voit quoi** | Chargé de compte : les commissions de ses entreprises ; Finance : toutes ; Responsable commercial : son équipe |
| **À trancher** | Où se trouve ce suivi (fiche entreprise, liste dédiée, tableau de bord) ; qui change quel état ; justificatif de versement ; **lot à planifier après S4.1** |

## 4. Livrables attendus
| Du graphiste (Figma) | De moi (développement) |
|---|---|
| Maquettes haute fidélité des écrans ci-dessus, **clair et sombre**, dans tous leurs états | Les données et les droits réels de chaque écran (ce document, tenu à jour) |
| Prototype navigable du parcours de chaque écran | Les jetons et composants de l'application (pour réemploi) |
| Composants Figma nommés comme ceux de l'application, annotations d'accessibilité (ordre du clavier, noms accessibles) | Un retour écrit sur la faisabilité avant la validation d'un écran |
| Une version datée par écran validé | Une fiche de décision (DDR) par sujet tranché et la mise à jour du document de design |

**Règle de travail.** Un écran n'est codé qu'une fois sa maquette validée par la direction produit ; tout écart constaté ensuite est consigné (écart maquette ↔ réalisé) plutôt que corrigé en silence.

## 5. Ordre du jour proposé pour l'atelier (≈ 90 min, avec le graphiste)
1. Confirmer les 5 écrans et l'ajout du suivi des commissions (10 min).
2. Pour chaque écran : premier regard, actions fréquentes, états, droits, libellés (15 min × 5).
3. Ce qui reste hors séance et l'ordre de livraison des maquettes (5 min).

Les décisions sont consignées dans `docs/QUESTIONS-ET-DECISIONS.md` ; chaque sujet de design tranché donne une fiche DDR.
