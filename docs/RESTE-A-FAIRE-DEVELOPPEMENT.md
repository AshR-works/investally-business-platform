# Reste à faire sur le développement

**Date** : 2026-11-05 · **Statut** : **état des lieux, à valider** · **Calendrier** : [diagramme de Gantt](GANTT-PROJET.md) · **Sources** : [plan de conception](DESIGN-CODE-ARCHITECTURE-PLAN.md), [dette technique](TECH-DEBT.md), [questions et décisions](QUESTIONS-ET-DECISIONS.md), cas d'usage ([flux transverses](CAS-D-USAGE-FLUX-TRANSVERSES.md), [module commercial](CAS-D-USAGE-MODULE-COMMERCIAL.md), [module Investudy](CAS-D-USAGE-MODULE-INVESTUDY.md))

> Ce document répond à une question : **que reste-t-il à construire, dans quel ordre, et qu'est-ce qui bloque quoi ?** Les tailles sont des **ordres de grandeur** (un sprint = une semaine au plus, décision du 2026-10-20), pas des engagements. Rien n'est décidé ici : les décisions en attente sont celles de la direction produit.

## 1. Où nous en sommes
| Bloc | État |
|---|---|
| **Fondations** (S1 à S3.8) : architecture, identité, authentification, MFA, droits et portées, administration, mot de passe oublié, documents | **Validé** |
| **Habillage et accès** (H1, H2) : design, navigation, écrans d'accès, sessions et historique | **Validé** |
| **Module commercial livré** : entreprises (S4.0), modifier et exporter une fiche, contacts (S4.1a), tableau des entreprises (S4.1b), offres (S4.2a), décharges signées (S4.2b), relances (S4.2c), agenda : rendez-vous et visites (S4.2d) | **Validé** (étiquettes `s4-0` à `s4-2d`) |
| **Valeurs par défaut à confirmer** | D29 à D35 (contacts, cartes ou tableau, offres, décharges, relances, agenda) : appliquées, signalées « à confirmer » |
| **Cadrage fonctionnel** : 45 écrans de référence (wireframes), flux transverses F1 à F7, module commercial C1 à C5, module Investudy I1 à I5 | **Validé** (propositions à confirmer, voir § 4) |
| **Reste de l'application** | À construire (voir § 2) |

Chiffres au 2026-11-06 : 970 tests unitaires, 383 tests d'intégration sur base jetable (dont 8 de `core-schema` fragiles sous charge, D149), 536 tests de l'interface, 49 mutants sur 49 tués au dernier lot, audit d'accessibilité automatique sur le navigateur réel, test d'architecture sans violation.

## 2. Feuille de route restante
Ordre retenu le 2026-10-21 (DEC-005) : module commercial, puis Investudy, puis pilotage, puis Stocks, puis durcissement et mise en production, puis l'ERP.

| Lot | Contenu | Taille indicative | Dépend de |
|---|---|---|---|
| **S4.2a** Offres | *Validé* : référence, états, dépôt, réponse du client, retrait avec motif | — | — |
| **S4.2b** Décharges | *Validé* : décharge signée avec son fichier, une seule décharge valide par offre, documents de l'offre | — | — |
| **S4.2c** Relances | *Validé* : relances planifiées, liste « À faire », annulation avec l'offre, colonne « Prochaine relance » | — | — |
| **S4.2d** Agenda | *Validé* : rendez-vous (DAF, décideur) et visites, vues jour, semaine et mois, conflit d'horaire en avertissement, report, tenue et annulation. Reste : rappels envoyés (D85), synchronisation Outlook (D88) | — | — |
| **S4.3a** Opportunités | *Validé* : pipeline en cartes ou par étape, règle du rendez-vous décideur, dérogation, clôture perdue ou gagnée (D28) | — | — |
| **S4.3b** Entreprises : statuts et responsable | *Validé* : statut manuel d'un cran (CU-C-05), changement de responsable (D17), fiche 360° (opportunités, rendez-vous), colonne Responsable | — | Votre « Je valide » ; défauts D37 |
| **S4.3c** Valeur et lien rendez-vous | *Validé* : colonne « Valeur » du tableau des entreprises ; lien d'un rendez-vous à une opportunité (D93, D104) | — | Votre « Je valide » ; défauts D38 |
| **S4.4a** Agréments | *Validé* : agrément (promesse de paiement signée), entreprise « Cliente », honorer / expirer / annuler | — | Défauts D39 à confirmer |
| **S4.4b** Ambassadeurs | *Validé* : création manuelle avec origine (client ou apprenant), liste, modification (les suggestions attendent les certifications d'Investudy) | — | Défauts D40 à confirmer |
| **S4.4a-bis** Correctifs décidés (D41) | *Validé* : état « demandé » et payeur tiers sur l'agrément, constat du paiement par la Finance (le DAF), second facteur récent sur le changement de responsable | — | Défauts D42 à confirmer |
| **S4.4c** Commissions à verser | *Validé* : commission due à l'honneur de l'agrément, déblocage par le DAF seul, versement avec justificatif (reçu ou ordre de versement), commission figée (flux F3) | — | Défauts D44 à confirmer |
| **S5.1** Catalogue Investudy | *Validé* : programmes, **certificats** (tarifs complet et par module, modules ordonnés), **modules partagés** (magistral ou pratique sur poste), **salles** (avec postes ou de cours, postes en panne, capacité utile), formateurs (internes ou externes), **rythmes** de session (jour ouvert, soir en préparation) ; référentiel sans propriétaire, archivage sans suppression (D46, DDR-0028) ; jeu de démonstration chargé **par blocs** | 1 session | S4.4 ; cas d'usage validés |
| **S5.2a** Sessions de formation | *Livré, validation en attente* : sessions (certificat, rythme, salle, formateur, capacité plafonnée par les places utiles, salle à postes pour un module pratique, aucun chevauchement), ouverture, **report par changement de date**, annulation motivée, portée du formateur ; décisions D47 et défauts D48 ; jeu de démonstration par blocs (bloc « sessions ») | 1 session | S5.1 ; D47 |
| **S5.2b** Apprenants et inscriptions | Fiche apprenant (distincte du contact, lien facultatif), inscriptions liées à l'agrément avec contrôle de capacité et de doublon, confirmation par le Responsable Investudy, annulation, replacement, suppression logique | 1 session | S5.2a ; D47 |
| **S5.3** Suivi pédagogique | Présences, évaluations, clôture, certificats et attestations, suggestion d'ambassadeur | 1 à 1,5 session | S5.2 ; seuils de certification |
| **S6.1** Tableaux de bord commerciaux | Indicateurs du chargé de compte et du Responsable commercial | 1 session | S4.3 ; liste fermée des pays (D57) |
| **S6.2** Tableaux de bord Investudy, Administration, Sécurité | Indicateurs, alertes sur les rafales de réinitialisation (D25) | 1 session | S5.3 |
| **S6.3** Reporting et incidents | Incidents d'abord, puis rapports périodiques ; **suivi des performances seulement après avis juridique et RH** (DEC-006) | 1,5 session | D60 (vues partagées) ; avis juridique |
| **ST** Stocks | Articles, fournisseurs, mouvements immuables, inventaire, seuils, tableau de bord | 2 sessions | **Cas d'usage non rédigés** |
| **S7.1** Durcissement | Rôle SQL applicatif, partitions planifiées, sauvegardes, supervision, stockage objet des documents (D41), clés tournantes (D10, D12), CSP à nonce (D20), liste de mots de passe étendue (D7) | 1,5 session | — |
| **S7.2** Mise en production | Docker et CI exécutés pour de vrai, **analyse antivirus (D42, bloquante)**, e-mail Microsoft 365 réel, revue de sécurité, tests de bout en bout automatisés (D22) | 1,5 session | **Accès Microsoft 365 (D9)**, avis juridique |
| **ERP** Finance, RH, Fiscalité, reporting de direction | Hors CRM : facturation et paiements (flux F3, F4), RH, fiscalité, extraction de l'identité vers une connexion unique | À chiffrer | **Cas d'usage non rédigés** ; décision de démarrage de l'ERP |

**Total indicatif du CRM jusqu'à la mise en production : environ 16 à 20 sessions.** L'ERP s'y ajoute et n'est pas chiffré.

### Lots transversaux sans sprint attribué
| Besoin | Origine | Proposition |
|---|---|---|
| **Réattribuer le propriétaire d'une entreprise** | D17 | *Réalisé (S4.3b)* : permission dédiée, confirmation par case à cocher, audit ; second facteur récent non exigé (D102) |
| **Export de listes et actions groupées** | D37, D59 | Cadrage de sécurité (option C : lire donne exporter, avec second facteur récent), puis un premier export |
| **Facilitateur modifiable, plusieurs facilitateurs** | D53 | Avec la fiche entreprise 360° |
| **Vues partagées** (rapports des employés, agendas) | D60 | Modèle d'audience à décider avant l'agenda |
| **PDF produit par le serveur** | D61 | Avec la charte des documents (fiche, offre, certificat, émargement) |
| **Prototype de design 0.5.0** | D49 | Ajouter contacts, offres, tableaux, fenêtres, œil du mot de passe |

## 3. Décisions en attente, par lot qu'elles bloquent
*Une **feuille de décision** avec options, grilles et recommandations est prête : [ARBITRAGE-DECISIONS-EN-ATTENTE.md](cadrages/ARBITRAGE-DECISIONS-EN-ATTENTE.md) (FD-1 à FD-11).*

| Pour… | Décision à prendre | Ma proposition de départ |
|---|---|---|
| **S4.2b** | Une décharge sans fichier est-elle acceptée ? Annulation d'une décharge ? | Fichier obligatoire ; annulation possible par le Responsable commercial |
| **S4.2c** | Délai par défaut et nombre maximum de relances | 7 jours ; trois relances |
| **S4.2d** | Un conflit d'horaire bloque-t-il ? Canal des rappels ? Audience d'un agenda partagé (D60, D16) | Avertir sans bloquer ; rappel dans l'application seulement |
| **S4.3** | Transitions du statut d'une entreprise (CU-C-05) ; étapes et ordre des opportunités ; motifs de perte | Statut manuel ; étapes du prototype ; liste fermée de motifs |
| **S4.4** | **Agrément** : places ou somme globale (D1), payeur tiers (D2), expiration (D3), effet sur les inscriptions (D4), déclencheur de la commission « due » et de la demande de paiement | Valeurs du registre ; à préciser avec la direction commerciale |
| **S5** | Confirmation des inscriptions, liste d'attente, seuils de certification, apprenant distinct du contact (D7), barème, annulation ou report, réouverture, lecture des certifications par le chargé de compte (D31) | Voir `CAS-D-USAGE-MODULE-INVESTUDY.md` § 13 |
| **S6** | Pays en liste fermée (D57) ; définition de chaque indicateur ; suivi des performances | Liste fermée ; définitions à rédiger avec vous |
| **S7** | Durée de conservation de l'audit et des données personnelles (D11, D55, D65) ; conservation des documents archivés (D45) | Avis juridique |
| **À confirmer, déjà appliqué** | Contacts (D29), cartes ou tableau pour les entreprises (D30), offres (D32) | Valeurs par défaut en place |

## 4. Actions qui ne dépendent pas du code
| Action | Qui | Pourquoi |
|---|---|---|
| **Accès Microsoft 365** (locataire, application, boîte d'envoi, SPF, DKIM, DMARC) | Administrateur M365 | Aucun e-mail réel tant qu'il manque ; **bloque la mise en production** (D9) |
| **Deuxième SuperAdmin nominatif** | Direction | Un seul compte au départ : risque de blocage (D10, R13) |
| **Avis juridique** : audit 10 ans, lecture par la Direction, données des apprenants, contacts, facilitateurs, suivi des performances | Juridique | Avant la mise en production (D11) |
| ~~Exiger la vérification dans les règles de la branche `main`~~ | Vous (GitHub) | **Fait** : la règle `protection-main` est active (PR obligatoire, contrôle `verify` requis, pas de poussée forcée ni de suppression) |
| **Logos au format SVG et variante sombre** ; charte graphique des documents | Graphiste | Fiche, offre, certificat, émargement, facture (D35, D61) |
| **Mentions légales et numérotation des documents** | DAF | Gabarits provisoires en attendant |
| **Réponses sur la commission** : déclencheur de « due », qui la débloque | Direction administrative et financière | Flux F3, lot S4.4 |
| **Confirmer les valeurs par défaut** (D29, D30, D32) | Direction produit | Elles sont appliquées mais non validées |

## 5. Dette technique à solder avant la mise en production
| Thème | Éléments | Lot |
|---|---|---|
| **Sécurité** | Antivirus (D42, bloquant), rotation des clés JWT et MFA (D10, D12), CSP à nonce (D20), liste de mots de passe courants (D7), limitation de débit partagée (D8), IP réelle derrière le proxy (D40) | S7.1, S7.2 |
| **Exploitation** | Documents sur disque local → stockage objet (D41), sauvegardes, e-mails sans file durable (D11, D26), rafraîchissement du jeton (D24) | S7.1 |
| **Qualité** | Écoute réelle avec lecteurs d'écran (D31), tests de bout en bout automatisés (D22), audit navigateur instable sur la machine de développement | S7.2 |
| **Interface** | Styles hérités à retirer (D32), thème appliqué après le premier rendu (D33), recherche globale à deux requêtes (D34), libellés dupliqués (D50, D51) | Au fil de S4 à S6 |
| **Données** | Objets propriétaires de documents à déclarer pour chaque nouveau module (D43), numérotation des offres sérialisée (D74) | Au fil de S4 à S6 |

## 6. Documentation encore à produire
| Document | Pour | Quand |
|---|---|---|
| Cas d'usage **Reporting** (rapports, incidents) | S6.3 | Avant S6 |
| Cas d'usage **Stocks** | ST | Avant ST |
| Cas d'usage **Finance** (facturation, paiements, commissions) | ERP, flux F3 et F4 | Avant l'ERP |
| Cas d'usage **RH et fiscalité** | ERP | Avant l'ERP |
| Mises à jour de la matrice de droits : `bd.opportunity.close_lost` et `close_won`, dérogation, agrément, commissions, exports | S4.3, S4.4 | Avec chaque lot |

## 7. Prochaine session proposée
**S4.4b — Ambassadeurs.** Créer un ambassadeur à la main, avec son origine (client ou apprenant) ; liste et fiche. Les suggestions après une certification attendent Investudy.

**S4.4c — Commissions à verser.** *Livré et validé.* Commission due à l'honneur de l'agrément, déblocage par le DAF seul, versement avec justificatif (flux F3). Le module commercial est complet.

Le module commercial est **terminé** (S4.4c validé) : il n'y a plus de validation en attente. Les décisions FD-1 à FD-6 sont prises (D41). Les valeurs par défaut D36 à D40, D42 à D44 restent à confirmer (FD-7), ainsi que FD-8 à FD-11. **S5.1 (catalogue Investudy) est validé** ; D46 reste à confirmer. **Avant S5.2 (sessions et inscriptions)** : réponses sur FD-9 (cas d'usage, apprenant distinct, droits de la Finance), FD-11 (formateurs externes, responsable Investudy) et les décisions D-FORM-1 à 3 des cadrages. La session S5.2 reprend le rythme de session (jour / soir), les salles et les places utiles du catalogue ; le sort de la planification module par module est à trancher (D148).
