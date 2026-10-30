# Catalogue des wireframes

*Généré par `build.mjs` à partir de `screens.mjs` : ne pas modifier à la main. Ouvrir `index.html` pour la galerie.*

| N° | Écran | Module | État | Sprint | Vue pour | Droits |
|---|---|---|---|---|---|---|
| 01 | [Connexion](svg/01-connexion.svg) | Accès | Livré | S3.1 / H2 | Tout utilisateur | Route publique ; verrouillage après échecs répétés. |
| 02 | [Second facteur : code à six chiffres](svg/02-mfa-code.svg) | Accès | Livré | S3.2 / H2 | Tout utilisateur | Après un mot de passe correct. |
| 03 | [Vue d’ensemble (hub)](svg/03-hub.svg) | Vue d’ensemble | Livré | H1 | Chargé de compte | Chaque module n’apparaît que si une permission le justifie. |
| 04 | [Entreprises : liste](svg/04-entreprises-liste.svg) | Business Development | Livré | S1 / H1b | Chargé de compte | bd.company.read (Propre, Équipe ou Tous). |
| 05 | [Fiche entreprise (état actuel)](svg/05-entreprise-fiche.svg) | Business Development | Livré | S3.6 / S4.0 | Chargé de compte | bd.company.read ; Modifier : bd.company.update ; commission : bd.commission.read. |
| 06 | [Création et modification d’une entreprise](svg/06-entreprise-modal.svg) | Business Development | Livré | S4.0 | Responsable commercial | bd.company.create / update ; commission : bd.commission.manage. |
| 07 | [Utilisateurs (administration)](svg/07-utilisateurs.svg) | Administration | Livré | S3.3 / H2 | Super administrateur | iam.user.* (Super administrateur seulement). |
| 08 | [Rôles d’un utilisateur : sélecteur et aperçu des droits](svg/08-roles-modal.svg) | Administration | Livré | S3.8 | Super administrateur | iam.user.assign_role ; on ne modifie pas ses propres rôles. |
| 09 | [Mon compte : sécurité et sessions](svg/09-mon-compte.svg) | Accès | Livré | H2 | Tout utilisateur | iam.session.read / revoke (Propre). |
| 10 | [Fiche entreprise 360° (cible)](svg/10-entreprise-360.svg) | Business Development | Proposé | S4.1 à S4.3 | Chargé de compte | Chaque onglet suit ses propres permissions (contacts, offres, opportunités, documents). |
| 11 | [Contacts : liste](svg/11-contacts-liste.svg) | Business Development | Livré | S4.1a | Chargé de compte | bd.contact.read ; portée selon l’entreprise liée. |
| 12 | [Création d’un contact (avec détection de doublon)](svg/12-contact-modal.svg) | Business Development | Livré | S4.1a | Chargé de compte | bd.contact.create / update. |
| 13 | [Offres : liste et état](svg/13-offres-liste.svg) | Business Development | Proposé | S4.2 | Chargé de compte | bd.offer.read ; création : bd.offer.create. |
| 14 | [Offre : décharge et relances](svg/14-offre-fiche.svg) | Business Development | Proposé | S4.2 | Chargé de compte | bd.offer.*, bd.receipt.*, bd.followup.*. |
| 15 | [Dépôt de la décharge signée](svg/15-decharge-modal.svg) | Business Development | Proposé | S4.2 | Chargé de compte | bd.receipt.create. |
| 16 | [Relances à faire](svg/16-relances.svg) | Business Development | Proposé | S4.2 | Chargé de compte | bd.followup.read / complete (Propre ou Équipe). |
| 17 | [Agenda : vue semaine](svg/17-agenda-semaine.svg) | Business Development | Proposé | S4.2b | Chargé de compte | Propre / Équipe / Tous selon le rôle ; agenda partagé : règle d’audience (D60). |
| 18 | [Création d’un rendez-vous](svg/18-rdv-modal.svg) | Business Development | Proposé | S4.2b / S4.3 | Chargé de compte | bd.appointment.create. |
| 19 | [Opportunités : cartes par six](svg/19-opportunites-cartes.svg) | Business Development | Livré | Prototype v0.4.0 ; écran réel : S4.3 | Chargé de compte | bd.opportunity.* (Propre, Équipe). |
| 20 | [Opportunités : vue « Par étape »](svg/20-opportunites-etapes.svg) | Business Development | Proposé | S4.3 | Chargé de compte | bd.opportunity.advance. |
| 21 | [Opportunité : fiche et passage d’étape](svg/21-opportunite-fiche.svg) | Business Development | Proposé | S4.3 | Chargé de compte | bd.opportunity.update / advance / close. |
| 22 | [Dérogation à la règle du RDV décideur](svg/22-derogation-modal.svg) | Business Development | Proposé | S4.3 | Responsable commercial | Dérogation : Responsable commercial uniquement. |
| 23 | [Agrément (promesse de paiement)](svg/23-agrement-fiche.svg) | Business Development | Proposé | S4.4 | Chargé de compte | À confirmer : droits d’agrément (hypothèses de l’architecture). |
| 24 | [Ambassadeurs](svg/24-ambassadeurs.svg) | Business Development | Proposé | S4.4 | Chargé de compte | bd.ambassador.read / create. |
| 25 | [Commissions à verser](svg/25-commissions.svg) | Business Development | Proposé | Après S4.1 (D54) | Chargé de compte | bd.commission.read (Propre pour le chargé de compte) ; changement d’état : à décider. |
| 26 | [Catalogue : programmes et formations](svg/26-catalogue.svg) | Investudy | Proposé | S5.1 | Responsable Investudy | training.program / training.read ; gestion : TRAINING_MANAGER. |
| 27 | [Sessions : calendrier et capacité](svg/27-sessions.svg) | Investudy | Proposé | S5.2 | Responsable Investudy | training.session.*. |
| 28 | [Session : inscrits, présences, évaluations](svg/28-session-detail.svg) | Investudy | Proposé | S5.2 / S5.3 | Formateur / Responsable Investudy | Formateur : ses sessions (Propre) ; gestion : Responsable Investudy. |
| 29 | [Apprenants](svg/29-apprenants.svg) | Investudy | Proposé | S5.2 | Responsable Investudy | training.learner.read / create / update. |
| 30 | [Inscription d’un apprenant à une session](svg/30-inscription-modal.svg) | Investudy | Proposé | S5.2 | Chargé de compte | training.enrollment.create (Propre). |
| 31 | [Feuille de présence](svg/31-presences.svg) | Investudy | Proposé | S5.3 | Formateur | training.attendance.record (ses sessions). |
| 32 | [Certifications et attestations](svg/32-certifications.svg) | Investudy | Proposé | S5.3 | Responsable Investudy | training.certification.issue / revoke. |
| 33 | [Tableau de bord : chargé de compte](svg/33-dashboard-compte.svg) | Reporting | Proposé | S6.1 | Chargé de compte | reporting.dashboard.account_manager (Propre). |
| 34 | [Tableau de bord : Responsable commercial](svg/34-dashboard-commercial.svg) | Reporting | Proposé | S6.1 | Responsable commercial | reporting.dashboard.head_of_sales (Équipe ou Tous). |
| 35 | [Tableau de bord : Direction](svg/35-dashboard-direction.svg) | Reporting | Proposé | S6.1 / S6.2 | Direction (DG, DGA) | reporting.dashboard.direction (Tous) ; export tracé. |
| 36 | [Tableau de bord : Investudy](svg/36-dashboard-investudy.svg) | Reporting | Proposé | S6.2 | Responsable Investudy | reporting.dashboard.training. |
| 37 | [Rapports des employés (vue partagée)](svg/37-rapports-employes.svg) | Reporting | Proposé | S6.3 | Tout employé (audience à définir) | Vue partagée : audience (tous, service, équipe) plutôt que portée par propriétaire (D60). |
| 38 | [Incidents (opérationnels et sécurité)](svg/38-incidents.svg) | Reporting | Proposé | S6.3 | Tout employé / Responsables | Déclaration : tous ; traitement : responsables ; sécurité : Super administrateur. |
| 39 | [Stocks : articles et seuils](svg/39-stock-articles.svg) | Stocks | Proposé | ST | Gestionnaire de stock (rôle à créer) | Rôle Logistique à confirmer (question ouverte). |
| 40 | [Stocks : mouvements et inventaire](svg/40-stock-mouvements.svg) | Stocks | Proposé | ST | Gestionnaire de stock | Mouvements immuables ; correction par un mouvement inverse. |
| 41 | [Facturation : liste](svg/41-factures.svg) | Finance | Proposé | ERP (Finance) | Finance / DAF | Documents financiers : le DAF exporte les siens, avec trace. |
| 42 | [Document : facture (charte)](svg/42-facture-document.svg) | Finance | Proposé | Charte des documents | Finance / DAF | Export : DAF et personnes autorisées, tracé. |
| 43 | [Congés : demandes et soldes](svg/43-conges.svg) | RH et fiscalité | Proposé | ERP (RH) | Employé / RH | Employé : ses demandes ; RH : tout ; responsable : son équipe. |
| 44 | [Échéances fiscales](svg/44-echeances-fiscales.svg) | RH et fiscalité | Proposé | ERP (Fiscalité) | Fiscalité / DAF | Rôle Fiscalité ; export tracé. |
| 45 | [Journal d’audit](svg/45-audit.svg) | Administration | Proposé | S6.2 / S7.2 | Direction / Super administrateur | audit.log.read (Tous) ; export : audit.log.export, tracé. |
