# ADR-0002 — Prisma confiné à l'Infrastructure

- **Statut** : Proposé (2026-10-20, Sprint 0)
- **Décideurs** : Tech Lead, Architecte

## Contexte
La migration future vers ASP.NET Core/EF ne doit pas imposer de réécrire le métier.

## Décision
Seul `infrastructure/persistence` importe `@prisma/client`. Le Domain définit des interfaces de repository ; l'Infrastructure les implémente. Le schéma Prisma (source de vérité du modèle relationnel) reste un détail de persistance.

## Conséquences
+ Domain et Application testables sans base. + ORM remplaçable. − Plus de code (interfaces + implémentations + mappers). Contrôlé par règle d'architecture automatique.

## Alternatives rejetées
Prisma dans les use cases ou controllers (rapide, mais verrouille l'ORM et mélange métier et persistance).
