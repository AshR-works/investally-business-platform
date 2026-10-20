# ADR-0001 — Monolithe modulaire

- **Statut** : Proposé (2026-10-20, Sprint 0)
- **Décideurs** : Tech Lead, Architecte

## Contexte
Équipe unique, charge interne modeste, contextes métier non encore éprouvés. Besoin d'évolutivité sur 10 ans.

## Décision
Une application NestJS déployée comme une unité, découpée en modules par contexte (domain/application/infrastructure/presentation). Les modules communiquent via API publique et événements de domaine ; références par identifiant ; pas d'import des internes d'un autre module (vérifié en CI).

## Conséquences
+ Déploiement et debug simples, transactions locales. + Un contexte peut être extrait en service plus tard si une frontière est prouvée. − Discipline requise : les garde-fous CI sont obligatoires, sinon le monolithe se dégrade en 'big ball of mud'.

## Alternatives rejetées
Microservices d'emblée (monolithe distribué, coût d'exploitation, cohérence distribuée). Monolithe en couches techniques (couplage entre domaines).
