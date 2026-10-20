# ADR-0003 — Entités Domain distinctes des modèles Prisma

- **Statut** : Proposé (2026-10-20, Sprint 0)
- **Décideurs** : Tech Lead, Architecte

## Contexte
Les types générés par Prisma reflètent les tables, pas les invariants métier. Les réutiliser ferait fuir la persistance dans le Domain.

## Décision
Chaque agrégat a une entité Domain (comportement, invariants, Value Objects) et un mapper explicite vers/depuis le modèle Prisma, écrit dans l'Infrastructure. Pas de mapper pour les simples lectures de reporting : des read models dédiés y suffisent.

## Conséquences
+ Domain pur et portable vers C#. − Coût de mapping (dette connue, acceptée). Les gabarits de module de S1 réduiront la répétition.

## Alternatives rejetées
Entités = types Prisma (anémique, couplage fort). Active Record.
