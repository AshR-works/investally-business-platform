# Design Code Architecture Plan — Investally Business Platform

## Context
- **Démarré le** : 2026-10-20 (Sprint 0 — Cadrage)
- **Produit** : plateforme métier propriétaire Investally (fintech) + centre de formation Investudy. CRM/prospection → formation → finance → RH → fiscalité → reporting → sécurité/audit.
- **Stack cible** : Next.js + TypeScript (front), NestJS + TypeScript (back), PostgreSQL, Prisma, Docker. Migration future possible vers ASP.NET Core + EF sans réécriture du métier.
- **Avantage différenciant (HYPOTHÈSE, à confirmer)** : le pipeline commercial B2B jusqu'à l'inscription Investudy (cœur), le reste étant support/générique.
- **Charge année 1 (HYPOTHÈSE, à confirmer)** : < 100 utilisateurs internes, < 10 000 contacts/apprenants, < 100 req/s en pointe. Une seule base PostgreSQL suffit.
- **Dépendances sortantes (HYPOTHÈSE)** : e-mail, SMS/OTP, stockage de documents. Paiement/banque/télé-déclaration fiscale : hors périmètre v1.
- **Propriétaire** : une équipe. Taille et durée de sprint à confirmer.
- **Fiscalité (HYPOTHÈSE)** : Cameroun (OHADA, DGI, CNPS) — à confirmer avant le sprint Fiscalité.

## Phase Status
| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 1 — Draw the boundaries | clean-architecture | done (brouillon, à valider) | ARCHITECTURE.md | 2026-10-20 |
| 2 — Model the domain | domain-driven-design | done (brouillon; 4 questions métier ouvertes) | ARCHITECTURE.md | 2026-10-20 |
| 3 — Size the system | system-design | done (hypothèses de charge) | ARCHITECTURE.md | 2026-10-20 |
| 4 — Make data decisions | ddia-systems | done | ARCHITECTURE.md | 2026-10-20 |
| 5 — Keep modules deep | software-design-philosophy | done (cadrage léger) | TECH-DEBT.md | 2026-10-20 |
| 6 — Design for failure | release-it | done (cadrage léger; valeurs à mesurer en S1) | RELIABILITY.md | 2026-10-20 |
| 7 — Prove wiring, lock in habits | pragmatic-programmer | done (plan; preuve de câblage en S1) | TESTING.md + TECH-DEBT.md | 2026-10-20 |
| 8 — Cut scope to essential | 37signals-way | done (voir Périmètre v1) | VISION.md + ARCHITECTURE.md | 2026-10-20 |
| Optional — Align teams | team-topologies | skipped: équipe unique | OPERATIONS.md | |

## Sprint Plan (révisé le 2026-10-20 : CRM prioritaire, ADR-0005)
| Sprint | Produit | Objectif | Livrables du prompt maître |
|---|---|---|---|
| S0 Cadrage — **terminé** | — | Vision, architecture, ADR | 1, 2, 4, 16 |
| S1 Squelette CRM | CRM | Monorepo, CI, garde-fous de dépendances, tranche verticale `Company` + audit | 3, 14 (partiel) |
| S2 Sécurité & données Core CRM | CRM | RBAC, audit, sessions, schéma Prisma Core, migrations 001 + 008 | 5, 8, 9, 11 |
| S3 Core CRM implémenté | CRM | Auth JWT/refresh/MFA, RBAC, audit, documents | 10 |
| S4 Business Development | CRM | Entreprises, contacts, offres, décharges, relances, RDV, visites, opportunités, ambassadeurs | 5–7, 12 |
| S5 Investudy | CRM | Programmes, sessions, salles, formateurs, apprenants, inscriptions, présences, évaluations, certifications | 5–7, 12 |
| S6 Reporting & dashboards CRM | CRM | KPI commerciaux/formation, dashboards AccountManager, HeadOfSales, Investudy, Admin, Sécurité | 12–13 |
| S7 Production CRM | CRM | MFA avancé, monitoring, sauvegardes, audit avancé | 15 |
| ERP-1…n | ERP | Finance, RH, Fiscalité, reporting direction ; extraction IAM/SSO et paquets partagés | 5–7, 13 |
| Final | — | Stratégie .NET, dette, recommandation | 17, 18, 19 |

## Key Decisions
| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-10-20 | 1 | Monolithe modulaire (ADR-0001) | Un seul déploiement, frontières internes strictes ; microservices = monolithe distribué tant que les contextes ne sont pas prouvés |
| 2026-10-20 | 1 | Prisma confiné à `infrastructure/` (ADR-0002) | Condition de la migration .NET |
| 2026-10-20 | 1 | Entités Domain ≠ modèles Prisma (ADR-0003) | Idem ; coût de mapping assumé |
| 2026-10-20 | 1 | Audit via événements de domaine + intercepteur applicatif (ADR-0004) | Traçabilité sans polluer le métier |

| 2026-10-20 | S1 | CRM séparé de l'ERP, CRM prioritaire incluant Investudy ; une base par produit ; pas de paquets partagés avant l'ERP (ADR-0005) | Décision produit ; simplicité (37signals) |
| 2026-10-20 | 2 | Core = BD (+ Training secondaire) ; pas de modèle Personne unifié ; intégration par événements | Voir Decision Log d'ARCHITECTURE.md |

## Next Actions
- [ ] Répondre aux 4 questions ouvertes de la Phase 2 (agrément, cardinalité, apprenant/contact, ambassadeur) — métier
- [ ] Valider ARCHITECTURE.md (Phases 1–4) — Tech Lead
- [ ] Confirmer les 6 hypothèses d'intake (charge, dépendances, équipe, fiscalité, Core, validation du besoin) — Ingénieur logiciel
- [ ] **S1** : monorepo, Docker, CI, tests d'architecture, tranche verticale `Company` + audit

## Périmètre v1 (Phase 8 — ce qu'on coupe)
- **Livré d'abord** : Core (Auth, RBAC, Audit, Documents) puis Business Development.
- **Coupé de la v1** : CQRS avec bus, event sourcing, broker de messages, cache, réplicas, microservices, paiement en ligne, portail externe, application mobile, paie.
- **Différé avec déclencheur** : voir la table de Phase 3 dans ARCHITECTURE.md.
- **Workflow générique** : pas de moteur de workflow configurable en v1 ; les machines à états vivent dans les agrégats.

## Clôture Sprint 0
| Critère | État |
|---|---|
| Vision produit | `VISION.md` |
| Architecture métier (contextes, glossaire, agrégats) | `ARCHITECTURE.md` |
| Contrat Clean Architecture (ASCII + Mermaid, règles, garde-fous) | `ARCHITECTURE.md` |
| Données, charge, cohérence | `ARCHITECTURE.md` |
| ADR fondateurs | `adr/0001`–`0004` |
| Risques | `RISKS.md` |
| Fiabilité, tests, conventions | `RELIABILITY.md`, `TESTING.md`, `TECH-DEBT.md` |
| Validation métier | **en attente** : 4 questions de Phase 2 + hypothèses d'intake |
