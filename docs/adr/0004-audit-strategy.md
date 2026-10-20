# ADR-0004 — Stratégie d'audit et de traçabilité

- **Statut** : Proposé (2026-10-20, Sprint 0)
- **Décideurs** : Tech Lead, Architecte

## Contexte
Exigence : savoir qui, quoi, quand, d'où, sur quelle donnée, valeur avant/après, y compris consultation/téléchargement/export de documents.

## Décision
Table `AuditLog` en append-only (id, userId, sessionId, module, entityType, entityId, action, oldValue, newValue, ipAddress, device, createdAt). Alimentée (1) par un intercepteur de la couche Application qui porte le contexte de requête (user, session, IP, appareil) et (2) par des Domain Events pour les changements métier significatifs. Aucune règle métier dans l'Infrastructure d'audit. Rôle DB applicatif sans droit UPDATE/DELETE sur `AuditLog`. Détail finalisé en S2.

## Conséquences
+ Traçabilité complète sans polluer le Domain. − Volume de données : politique de rétention/partitionnement à définir (Phase 4). − Données sensibles dans old/new value : masquage de champs à spécifier.

## Alternatives rejetées
Triggers SQL seuls (pas d'IP/session). Journalisation manuelle dans chaque use case (oubli garanti).
