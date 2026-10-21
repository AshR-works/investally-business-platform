# Design Code Architecture Plan — Investally Business Platform

## Context
- **Démarré le** : 2026-10-20 (Sprint 0 — Cadrage)
- **Produit** : plateforme métier propriétaire Investally (fintech) + centre de formation Investudy. **Deux produits : CRM (prioritaire, Business Development + Investudy) puis ERP** (ADR-0005).
- **Stack cible** : Next.js + TypeScript (front), NestJS + TypeScript (back), PostgreSQL, Prisma, Docker. Migration future possible vers ASP.NET Core + EF sans réécriture du métier.
- **Avantage différenciant (HYPOTHÈSE)** : le pipeline commercial B2B jusqu'à l'inscription Investudy (cœur), le reste étant support/générique.
- **Charge (CONFIRMÉE le 2026-10-20)** : ≈ **20 utilisateurs** au démarrage (10 employés aujourd'hui), croissance possible si recrutement. Une seule base PostgreSQL, largement suffisante.
- **Équipe et cadence (CONFIRMÉES le 2026-10-20)** : les sprints sont menés par l'ingénieur logiciel d'Investally et Claude, **durée maximale : 1 semaine**.
- **Dépendances sortantes** : e-mail via **Microsoft 365** (décidé), stockage de documents. Paiement/banque/télé-déclaration fiscale : hors périmètre.
- **Fiscalité (HYPOTHÈSE)** : Cameroun (OHADA, DGI, CNPS), devise XAF — concerne surtout l'ERP.

## Phase Status
| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 1 — Draw the boundaries | clean-architecture | done | ARCHITECTURE.md | 2026-10-20 |
| 2 — Model the domain | domain-driven-design | done (décisions métier du 2026-10-20 intégrées ; détails de l'agrément à préciser avant S4.4) | ARCHITECTURE.md | 2026-10-20 |
| 3 — Size the system | system-design | done (charge confirmée : ≈ 20 utilisateurs) | ARCHITECTURE.md | 2026-10-20 |
| 4 — Make data decisions | ddia-systems | done | ARCHITECTURE.md | 2026-10-20 |
| 5 — Keep modules deep | software-design-philosophy | done (cadrage léger) | TECH-DEBT.md | 2026-10-20 |
| 6 — Design for failure | release-it | done (cadrage léger; valeurs à mesurer) | RELIABILITY.md | 2026-10-20 |
| 7 — Prove wiring, lock in habits | pragmatic-programmer | done | TESTING.md + TECH-DEBT.md | 2026-10-20 |
| 8 — Cut scope to essential | 37signals-way | done (voir Périmètre v1) | VISION.md + ARCHITECTURE.md | 2026-10-20 |
| Optional — Align teams | team-topologies | skipped: équipe de deux (ingénieur + Claude) | OPERATIONS.md | |

## Cadence de travail
- **Sprint = 1 semaine maximum**, un objectif livrable et vérifiable. Un sprint trop gros est découpé, jamais prolongé.
- **Début de sprint** : périmètre et plan de recette (`docs/SPRINT-n-RECETTE.md`) validés ensemble.
- **Fin de sprint** : recette exécutée, résultats honnêtes (vérifié / non vérifié), validation explicite de l'ingénieur, puis fusion dans `main` et tag `sN-validated`.
- **Branches** : `sprint/<id>-<nom>` depuis `main`, jamais de commit direct sur `main`.
- Les identifiants d'origine (S3, S4…) désignent des **phases** ; chacune est découpée en sprints d'une semaine (S3.1, S3.2…).

## Sprint Plan (révisé le 2026-10-20 : CRM prioritaire, sprints d'une semaine)
| Sprint | Produit | Objectif | Livrables du prompt maître |
|---|---|---|---|
| S0 Cadrage — **validé** | — | Vision, architecture, ADR | 1, 2, 4, 16 |
| S1 Squelette CRM — **validé** (tag `s1-validated`) | CRM | Monorepo, CI, garde-fous, tranche `Company` + audit | 3, 14 (partiel) |
| S2 Sécurité & données Core — **validé** (tag `s2-validated`) | CRM | RBAC, audit, schéma Core, migration, seed rôles/permissions | 5, 8, 9, 11 |
| **S3.1** Authentification — **validé** (tag `s3-1-validated`) | CRM | Utilisateurs, mot de passe argon2id, connexion, JWT ES256, sessions, rotation du refresh token, verrouillage et limitation de débit, audit des connexions | 8, 10 |
| **S3.2** MFA et amorçage — **validé** (tag `s3-2-validated`) | CRM | TOTP obligatoire (enrôlement, codes de secours, step-up), port e-mail Microsoft 365 (adaptateur journal en test), création du premier SuperAdmin | 8 |
| **S3.3** Autorisation et administration (backend) — **validé** (tag `s3-3-validated`) | CRM | `@Protected` (permission + portée + step-up), API utilisateurs/rôles/sessions, invitation par e-mail, propriétaire des entreprises | 10, 11 |
| **S3.4** Front de base — **en cours, recette exécutée, validation en attente** | CRM | Pages web : connexion, scan du QR MFA, codes de secours, activation d'invitation, administration des utilisateurs, mon compte (mot de passe, codes de secours, sessions), en-têtes de sécurité | 10 |
| **S3.5** Mot de passe oublié et livrables — **en cours, recette exécutée, validation en attente** | CRM | Bouton « Mot de passe oublié » (libre-service sécurisé et traçable + déclenchement par un administrateur), commentaires sur toutes les fonctions, livrables récapitulatifs (`docs/livrables/`) | 8, 10 |
| **ÉTAPE 0** *(décidée le 2026-10-21, DEC-005)* | — | **Valider S3.4 et S3.5** ; obtenir l'**accès Microsoft 365** ; désigner **deux SuperAdmin** ; lancer l'**avis juridique** (audit 10 ans, données de performance) | — |
| **H1** Habillage minimal + hub | CRM | Tailwind, jetons, polices hébergées, logos, coque, **navigation B+ (hub, recherche globale, rail compact)** ; **le style s'applique ensuite écran par écran, sans sprint H3 séparé** | 10 |
| **H2** Authentification complète et sessions | CRM | 18 écrans (MFA, QR, codes de secours, réinitialisation, sessions actives, historique des connexions) + endpoint d'historique | 10 |
| **S3.6** Documents | CRM | Téléversement, versions, SHA-256, téléchargement, traçabilité complète (prérequis des pièces jointes) | 9, 10 |
| **Cadrage UX** (avant S4.1) | CRM | Séance courte sur 5 écrans clés, **à partir des prototypes existants** ; chaque écran de S4 naît dans le nouveau style | — |
| **S4.1** Entreprises et contacts | CRM | Business Development : entreprises, contacts — **API et écrans livrés ensemble** | 10, 12 |
| **S4.2** Offres, décharges, relances | CRM | Offre, décharge, relances planifiées | 10 |
| **S4.2b** Agenda utilisateur *(ajouté le 2026-10-21)* | CRM | Événements (rendez-vous, relances, formations, échéances), vues semaine / mois / jour, rappels, droits Propre / Équipe / Tous ; premier consommateur : les relances et rendez-vous des offres | 10 |
| **S4.3** Rendez-vous, visites, opportunités | CRM | Pipeline, règle du RDV décideur avec dérogation | 10 |
| **S4.4** Agrément et ambassadeurs | CRM | Agrément (promesse de paiement), ambassadeurs, événements vers Investudy | 10 |
| **S5.1** Catalogue Investudy | CRM | Programmes, formations, salles, formateurs | 10 |
| **S5.2** Sessions et inscriptions | CRM | Sessions, apprenants, inscriptions liées à l'agrément | 10 |
| **S5.3** Suivi pédagogique | CRM | Présences, évaluations, certifications, suggestion d'ambassadeur | 10 |
| **S6.1** KPI et dashboards commerciaux | CRM | KPI, dashboards Chargé de compte et Responsable commercial | 12, 13 |
| **S6.2** Dashboards Investudy, Admin, Sécurité | CRM | Dashboards Investudy, Administration, Sécurité, rapports | 12, 13 |
| **S6.3** Reporting et incidents *(EXD-08, DEC-005 : incidents d'abord)* | CRM / transverse | Incidents (opérationnels et sécurité), puis rapports périodiques ; **suivi des performances seulement après avis juridique et RH (DEC-006)** | 12, 13 |
| **ST** Stocks *(EXD-07, DEC-004, ADR-0007)* | Module autonome hébergé dans le CRM, extractible vers l'ERP | Articles, catégories, fournisseurs, mouvements immuables, inventaire, seuils, tableau de bord | 5–7 |
| **S7.1** Durcissement | CRM | Rôle SQL applicatif, création planifiée des partitions, sauvegardes, supervision | 8, 15 |
| **S7.2** Mise en production | CRM | Docker et CI exécutés pour de vrai, revue de sécurité, audit avancé | 15 |
| ERP-1…n | ERP | Finance, RH, Fiscalité, reporting direction ; extraction IAM/SSO et paquets partagés | 5–7, 13 |
| Final | — | Stratégie .NET, dette, recommandation | 17, 18, 19 |

## Key Decisions
| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-10-20 | 1 | Monolithe modulaire (ADR-0001) | Un seul déploiement, frontières internes strictes |
| 2026-10-20 | 1 | Prisma confiné à `infrastructure/` (ADR-0002) | Condition de la migration .NET |
| 2026-10-20 | 1 | Entités Domain ≠ modèles Prisma (ADR-0003) | Idem ; coût de mapping assumé |
| 2026-10-20 | 1 | Audit via événements de domaine + intercepteur applicatif (ADR-0004) | Traçabilité sans polluer le métier |
| 2026-10-20 | S1 | CRM séparé de l'ERP, CRM prioritaire incluant Investudy ; une base par produit (ADR-0005) | Décision produit ; simplicité |
| 2026-10-20 | 2 | Core = BD (+ Training secondaire) ; pas de modèle Personne unifié ; intégration par événements | Voir Decision Log d'ARCHITECTURE.md |
| 2026-10-20 | S2 | Accès et sécurité : TRAINING_MANAGER ajouté, **SuperAdmin accès complet**, **MFA obligatoire pour tous**, équipe = subordonnés directs, durées de session confirmées, e-mail Microsoft 365, audit 10 ans (ADR-0006) | Décisions de la direction produit |
| 2026-10-20 | 2 | **Agrément formation = promesse de paiement**, propriété de Business Development ; plusieurs opportunités par entreprise ; apprenant sans accès au CRM ; ambassadeur manuel | Décisions métier |
| 2026-10-20 | 3 | Charge confirmée ≈ 20 utilisateurs ; Support lecture seule ; Direction lit l'audit ; XAF par défaut ; pas de suivi de paiement dans le CRM | Décisions et recommandations appliquées |
| 2026-10-20 | — | Sprints d'une semaine maximum, menés par l'ingénieur et Claude | Décision de la direction produit |

## Next Actions
- [ ] Consulter `QUESTIONS-ET-DECISIONS.md` : registre des questions sensibles, décisions et questions ouvertes (§D)
- [ ] Valider S2 (voir `SPRINT-2-RECETTE.md`) puis fusionner dans `main` — Ingénieur logiciel
- [ ] **S3.1** : planifier le périmètre et la recette de l'authentification — ensemble
- [ ] Fournir l'accès Microsoft 365 pour l'envoi d'e-mails (voir `SECURITY.md` §2.6) — avant S3.2, administrateur M365
- [ ] Préciser les points sur l'agrément (voir `ARCHITECTURE.md`) — avant S4.4, métier
- [ ] Valider avec le juridique la conservation de l'audit (10 ans) — avant la mise en production
- [ ] Désigner au moins deux futurs SuperAdmin nominatifs — avant S3.2

## Périmètre v1 (Phase 8 — ce qu'on coupe)
- **Livré d'abord** : Core (Auth, RBAC, Audit, Documents) puis Business Development, puis Investudy.
- **Coupé de la v1** : CQRS avec bus, event sourcing, broker de messages, cache, réplicas, microservices, paiement en ligne, portail externe (apprenants compris), application mobile, paie, suivi du paiement dans le CRM.
- **Différé avec déclencheur** : voir la table de Phase 3 dans ARCHITECTURE.md.
- **Workflow générique** : pas de moteur de workflow configurable en v1 ; les machines à états vivent dans les agrégats.

## Clôture Sprint 0
| Critère | État |
|---|---|
| Vision produit | `VISION.md` |
| Architecture métier (contextes, glossaire, agrégats) | `ARCHITECTURE.md` |
| Contrat Clean Architecture (ASCII + Mermaid, règles, garde-fous) | `ARCHITECTURE.md` |
| Données, charge, cohérence | `ARCHITECTURE.md` |
| ADR | `adr/0001`–`0006` |
| Risques | `RISKS.md` |
| Fiabilité, tests, conventions | `RELIABILITY.md`, `TESTING.md`, `TECH-DEBT.md` |
| Validation métier | ✅ décisions du 2026-10-20 (reste : détails de l'agrément) |


## Décisions du 2026-10-21 (DEC-001 à DEC-006)
Ordre de réalisation retenu : **Étape 0** (validations, Microsoft 365, SuperAdmin, avis juridique) → **H1** → **H2** → **S3.6** → **Cadrage UX** → **S4.1 à S4.4** (+ Agenda S4.2b) → **S5** → **S6** (dont **S6.3** Reporting, incidents d'abord) → **ST** Stocks → **S7**. Détail et motifs : `design/05-AIDE-A-LA-DECISION.md`.
