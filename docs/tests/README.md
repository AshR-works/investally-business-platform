# Fiches de test

*Application de la [charte de tests](../CHARTE-DE-TESTS.md) : une fiche par **interface** (écran) et une fiche par **session** (lot). Elles servent à la recette utilisateur et à la non-régression.*

## Comment s'en servir
1. **Avant une validation** : ouvrir les fiches de la session et des écrans concernés, les rejouer avec les rôles indiqués, cocher, dater, signer.
2. **Après un changement d'écran** : rejouer sa fiche d'interface en entier (non-régression).
3. **Un écart** : le noter dans la section « Écarts constatés » de la fiche ; il devient un défaut (charte, § 10).
4. **Mise à jour** : un lot qui modifie un écran met à jour sa fiche d'interface ; la fiche de session d'un nouveau lot est créée à partir de sa recette (`docs/SPRINT-*-RECETTE.md`).

## Fiches d'interface (23)

| N° | Écran | Route | Lots | Dernière exécution |
|---|---|---|---|---|
| 01 | [Connexion](interfaces/01-connexion.md) | `/login` | S3.1, S3.4, H2a, S3.7 | |
| 02 | [Second facteur (MFA)](interfaces/02-second-facteur.md) | `/mfa` | S3.2, S3.4, H2a, S3.7 | |
| 03 | [Mot de passe oublié](interfaces/03-mot-de-passe-oublie.md) | `/forgot-password` | S3.5, H2a | |
| 04 | [Nouveau mot de passe](interfaces/04-nouveau-mot-de-passe.md) | `/reset-password` | S3.5, H2a, S3.7 | |
| 05 | [Activation d'une invitation](interfaces/05-activation-invitation.md) | `/invitation` | S3.3, S3.4, H2a, S3.7 | |
| 06 | [Mon compte](interfaces/06-mon-compte.md) | `/account` | S3.4, S3.7 | |
| 07 | [Sessions et connexions](interfaces/07-sessions-et-connexions.md) | `/account/sessions` | H2b | |
| 08 | [Administration des utilisateurs](interfaces/08-administration-utilisateurs.md) | `/admin/users` | S3.3, S3.4, S3.8 | |
| 09 | [Vue d'ensemble (hub)](interfaces/09-vue-d-ensemble.md) | `/` | H1 | |
| 10 | [Entreprises (tableau)](interfaces/10-entreprises.md) | `/companies` | S1, H1b, S4.0, S4.1b, S4.3b, S4.3c | |
| 11 | [Fiche d'une entreprise](interfaces/11-fiche-entreprise.md) | `/companies/[id]` | S3.6, S4.0, S4.0c, S4.1a, S4.2a–d, S4.3a–c, S4.4a, S4.4a-bis | |
| 12 | [Contacts](interfaces/12-contacts.md) | `/contacts` | S4.1a | |
| 13 | [Offres](interfaces/13-offres.md) | `/offers` | S4.2a, S4.2b | |
| 14 | [Relances](interfaces/14-relances.md) | `/followups` | S4.2c | |
| 15 | [Agenda (rendez-vous et visites)](interfaces/15-agenda.md) | `/agenda` | S4.2d, S4.3c | |
| 16 | [Opportunités (pipeline)](interfaces/16-opportunites.md) | `/opportunities` | S4.3a, S4.3b, S4.3c | |
| 17 | [Ambassadeurs](interfaces/17-ambassadeurs.md) | `/ambassadors` | S4.4b | |
| 18 | [Commissions](interfaces/18-commissions.md) | `/commissions` | S4.4c | |
| 19 | [Catalogue de formation](interfaces/19-catalogue-formation.md) | `/training` | S5.1 | |
| 20 | [Sessions de formation](interfaces/20-sessions-formation.md) | `/training/sessions` | S5.2a | |
| 21 | [Apprenants](interfaces/21-apprenants.md) | `/training/learners` | S5.2b | |
| 22 | [Inscriptions](interfaces/22-inscriptions.md) | `/training/enrollments` | S5.2b | |
| 23 | [Fiche d'une session](interfaces/23-fiche-session.md) | `/training/sessions/[id]` | S5.2b | |

## Fiches de session (36)

| Session | Intitulé | Étiquette | Vérifications | Dernière exécution |
|---|---|---|---|---|
| [s1](sessions/s1.md) | Sprint 1 — Plan de recette (validation avant clôture) | `s1-validated` | 29 | |
| [s2](sessions/s2.md) | Sprint 2 — Plan de recette (Sécurité et données Core du CRM) | `s2-validated` | 27 | |
| [s3-1](sessions/s3-1.md) | Sprint 3.1 — Authentification (périmètre et plan de recette) | `s3-1-validated` | 28 | |
| [s3-2](sessions/s3-2.md) | Sprint 3.2 — MFA, e-mail Microsoft 365 et premier SuperAdmin (périmètre et plan de recette) | `s3-2-validated` | 38 | |
| [s3-3](sessions/s3-3.md) | Sprint 3.3 — Autorisation, administration des comptes et invitations (périmètre et plan de recette) | `s3-3-validated` | 35 | |
| [s3-4](sessions/s3-4.md) | Sprint 3.4 — Front de base : connexion, MFA, invitation, administration, mon compte (périmètre et plan de recette) | `s3-4-validated` | 39 | |
| [s3-5](sessions/s3-5.md) | Sprint 3.5 — « Mot de passe oublié », commentaires du code et livrables (périmètre et plan de recette) | `s3-5-validated` | 36 | |
| [a11y-1](sessions/a11y-1.md) | Accessibilité 1 — vérification « lecteurs d'écran » | `a11y-1-validated` | 0 | |
| [correctifs-1](sessions/correctifs-1.md) | Correctifs de recette n° 1 : téléphones, fenêtres, barres de défilement, tableaux | `correctifs-1-validated` | 7 | |
| [h1](sessions/h1.md) | H1 et H1b — Habillage, hub et composants de données | `h1-validated`, `h1b-validated` | 8 | |
| [h2a](sessions/h2a.md) | H2a — Écrans d'accès au nouveau style | `h2a-validated` | 12 | |
| [h2b](sessions/h2b.md) | H2b — Sessions et historique des connexions | `h2b-validated` | 2 | |
| [idor](sessions/idor.md) | Contrat anti-IDOR | `idor-validated` | 5 | |
| [jeu-de-donnees](sessions/jeu-de-donnees.md) | Jeu de données de démonstration (module commercial) | `jeu-de-donnees-validated` | 7 | |
| [s3-6](sessions/s3-6.md) | S3.6 — Documents | `s3-6-validated` | 7 | |
| [s3-7](sessions/s3-7.md) | S3.7 — UX de l'authentification | `s3-7-validated` | 3 | |
| [s3-8](sessions/s3-8.md) | S3.8 — Rôles et permissions (UX-02) | `s3-8-validated` | 7 | |
| [s4-0](sessions/s4-0.md) | S4.0 — Fiche d'entreprise : facilitateur et commission | `s4-0-validated` | 6 | |
| [s4-0b](sessions/s4-0b.md) | S4.0 (retours de tests) — fenêtres, champs en surbrillance, pays | `s4-0b-validated` | 6 | |
| [s4-0c](sessions/s4-0c.md) | S4.0 (suite) — modifier et exporter une fiche d'entreprise | `s4-0c-validated` | 5 | |
| [s4-1a](sessions/s4-1a.md) | S4.1a — contacts des entreprises | `s4-1a-validated` | 8 | |
| [s4-1b](sessions/s4-1b.md) | S4.1b — tableau des entreprises (filtres, tri, effectifs, colonnes) | `s4-1b-validated` | 6 | |
| [s4-2a](sessions/s4-2a.md) | S4.2a — offres faites aux entreprises | `s4-2a-validated` | 8 | |
| [s4-2b](sessions/s4-2b.md) | S4.2b — décharges signées des offres | `s4-2b-validated` | 7 | |
| [s4-2c](sessions/s4-2c.md) | S4.2c — relances des offres | `s4-2c-validated` | 8 | |
| [s4-2d](sessions/s4-2d.md) | S4.2d — agenda : rendez-vous et visites | `s4-2d-validated` | 9 | |
| [s4-3a](sessions/s4-3a.md) | S4.3a — opportunités : le pipeline commercial | `s4-3a-validated` | 6 | |
| [s4-3b](sessions/s4-3b.md) | S4.3b — statuts d'entreprise, responsable, fiche 360° | `s4-3b-validated` | 8 | |
| [s4-3c](sessions/s4-3c.md) | S4.3c — valeur des opportunités et lien rendez-vous ↔ opportunité | `s4-3c-validated` | 7 | |
| [s4-4a-bis](sessions/s4-4a-bis.md) | S4.4a-bis — agréments : demandé, payeur tiers, constat par la Finance ; second facteur à la réattribution | `s4-4a-bis-validated` | 7 | |
| [s4-4a](sessions/s4-4a.md) | S4.4a — agréments : la promesse de paiement signée | `s4-4a-validated` | 8 | |
| [s4-4b](sessions/s4-4b.md) | S4.4b — ambassadeurs : clients ou apprenants devenus relais commerciaux | `s4-4b-validated` | 9 | |
| [s4-4c](sessions/s4-4c.md) | S4.4c — commissions des facilitateurs à verser | `s4-4c-validated` | 11 | |
| [s5-1](sessions/s5-1.md) | S5.1 — catalogue Investudy | `s5-1-validated` | 11 | |
| [s5-2a](sessions/s5-2a.md) | S5.2a — sessions de formation | `s5-2a-validated` | 14 | |
| [s5-2b](sessions/s5-2b.md) | S5.2b — apprenants et inscriptions | — | 12 | |

## Remarques
- Les fiches de session sont **dérivées des recettes** : en cas de doute, la recette fait foi. Celles des premiers sprints (S1 à S3.5) sont surtout des tests automatisés ; leurs « vérifications » rappellent ce que chaque contrôle prouve.
- Les fiches d'interface ne couvrent que les écrans **existants** ; les modules à venir (Formation, Finance, RH, Fiscalité, Stocks, Reporting, Sécurité) n'ont pas encore de fiche.
- Les captures et résultats d'accessibilité sont dans `docs/accessibilite/`.
