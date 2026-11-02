# Registre des fiches de décision de design (DDR)

Chaque décision de design porte une fiche courte : **contexte, options, décision, motif, version, exigences liées, statut**. Statuts : *Proposée · Acceptée · Remplacée · Rejetée*. Une fiche n'est jamais effacée.
Les arbitrages structurants suivent la [méthode d'arbitrage](../../METHODE-D-ARBITRAGE.md) ; leurs fiches **DEC** sont dans [../05-AIDE-A-LA-DECISION.md](../05-AIDE-A-LA-DECISION.md).

| N° | Titre | Statut | Version | Exigence / décision liée |
|---|---|---|---|---|
| [DDR-0001](DDR-0001-style-taupe-et-contrastes.md) | Style taupe et contrastes mesurés | Acceptée | 0.1.0 | — |
| [DDR-0002](DDR-0002-logos-et-theme-sombre.md) | Logos fournis et thème sombre monochrome | Acceptée | 0.1.0 | demande du 2026-10-21 |
| [DDR-0003](DDR-0003-panneau-et-selection-persistante.md) | Panneau principal et sélection persistante | Acceptée | 0.3.0 | EXD-01, EXD-02 |
| [DDR-0004](DDR-0004-navigation-b-plus.md) | Navigation B+ (hub, rail compact, bouton Déplier) | Acceptée | 0.4.0 | EXD-05, DEC-002 |
| [DDR-0005](DDR-0005-opportunites-hybrides.md) | Opportunités hybrides | Acceptée | 0.4.0 | EXD-04, DEC-003 |
| [DDR-0006](DDR-0006-versionnement-des-livrables.md) | Versionnement des livrables design | Acceptée | 0.4.0 | DEC-001 |
| [DDR-0007](DDR-0007-panneau-centre-et-bouton-de-depliage.md) | Panneau principal centré (option B) et bouton de dépliage en pictogramme | Acceptée (pictogramme à confirmer) | 0.4.1 | EXD-10, EXD-11, DEC-007 |
| [DDR-0008](DDR-0008-champ-de-code-unique.md) | Champ de code unique pour le second facteur | **Remplacée** par DDR-0009 | 0.4.1 | EXD-06 |
| [DDR-0009](DDR-0009-code-en-six-cases.md) | Code du second facteur en six cases | Acceptée | 0.4.1 | EXD-06 |
| [DDR-0010](DDR-0010-secrets-confirmations-et-affichage-unique.md) | Mot de passe affichable, confirmation des actions irréversibles, codes de secours à affichage unique | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-12, EXD-13 |
| [DDR-0011](DDR-0011-selecteur-de-roles-et-apercu-des-droits.md) | Sélecteur de rôles par familles et aperçu des droits effectifs | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-14 |
| [DDR-0012](DDR-0012-fiche-entreprise-mise-en-relation-facilitateur.md) | Fiche de création d'entreprise : coordonnées et mise en relation par un facilitateur | Acceptée (prototype à mettre à jour) | 0.4.1 | — |
| [DDR-0013](DDR-0013-fenetres-croix-champs-en-surbrillance.md) | Fenêtres : croix de fermeture, largeur minimale ; champs non conformes en surbrillance ; zones de texte à taille fixe | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-15, EXD-16 |
| [DDR-0014](DDR-0014-modifier-et-exporter-une-fiche.md) | Modifier une fiche d'entreprise ; exporter une fiche (qui voit exporte, chaque export est tracé) | Acceptée (prototype à mettre à jour) | 0.4.1 | — |
| [DDR-0015](DDR-0015-contacts-des-entreprises.md) | Contacts des entreprises : fiche, liste, doublons | Acceptée (prototype à mettre à jour) | 0.4.1 | — |
| [DDR-0016](DDR-0016-tableau-des-entreprises.md) | Tableau des entreprises : filtres, tri, effectifs par statut, colonnes au choix ; cartes réservées aux Opportunités | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-02, EXD-04 |
| [DDR-0017](DDR-0017-offres-aux-entreprises.md) | Offres faites aux entreprises : fiche, liste, cycle d'états (brouillon, déposée, acceptée, refusée, retirée) | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0018](DDR-0018-decharges-signees.md) | Décharges signées des offres : enregistrer avec le fichier, consulter, annuler avec motif ; documents de l'offre | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0019](DDR-0019-relances-des-offres.md) | Relances des offres : planifier, liste « À faire », terminer avec résultat, annulation automatique avec l'offre | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0020](DDR-0020-agenda-rendez-vous-et-visites.md) | Agenda : rendez-vous (DAF, décideur) et visites, vues jour / semaine / mois, conflit d'horaire en avertissement, report, tenue et annulation avec texte obligatoire | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0025](DDR-0025-ambassadeurs.md) | Ambassadeurs : création manuelle, origine client ou apprenant (non modifiable), e-mail unique, visibilité par créateur, modification réservée au Responsable commercial | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0024](DDR-0024-agrements.md) | Agréments : promesse de paiement signée d'une opportunité (montant et/ou places, validité facultative, document signé), entreprise « Cliente », honorer / expirer / annuler avec droits distincts | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0023](DDR-0023-valeur-et-lien-rendez-vous-opportunite.md) | Colonne « Valeur » (opportunités ouvertes par devise, selon le droit de lecture) et rendez-vous lié à une opportunité (règle de l'accord de principe précisée, D93) | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0022](DDR-0022-statuts-proprietaire-fiche-360.md) | Entreprises : statut manuel d'un cran avec retour (« Qualifiée » exige un contact), changement de responsable sous droit dédié et confirmation, fiche 360° en lecture (opportunités, rendez-vous) | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-13, EXD-16 |
| [DDR-0021](DDR-0021-opportunites-pipeline.md) | Opportunités : pipeline en cartes ou par étape, cinq étapes dans l'ordre, rendez-vous décideur ou dérogation avant l'accord de principe, clôture perdue (motif) ou gagnée (D28) | Acceptée (prototype à mettre à jour) | 0.4.1 | EXD-04, EXD-13, EXD-16 |
