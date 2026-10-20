# Fiabilité

> Statut : cadrage Sprint 0 (valeurs de départ ; ajustées en S1 avec mesures réelles).

## Integration-Point Audit
| Dépendance | Timeout | Circuit breaker | Bulkhead | Retry | Statut |
|---|---|---|---|---|---|
| PostgreSQL | connexion 3 s, requête 10 s (`statement_timeout`) | n/a | pool dimensionné ; pool séparé pour jobs/outbox | non automatique (transaction rejouée par le use case si conflit de version) | à implémenter S1 |
| Fournisseur e-mail | connexion 3 s, lecture 5 s | oui (5 échecs/30 s) | via outbox, hors chemin de requête | backoff exponentiel + jitter, max 5, puis *dead letter* | à implémenter S3 |
| Fournisseur SMS/OTP | 3 s / 5 s | oui | outbox ; OTP : repli e-mail ou TOTP | max 3 | à implémenter S3 |
| Stockage objet (documents) | 3 s / 30 s (upload) | oui | pool dédié | 2, idempotent par empreinte | à implémenter S3 |

Règle : aucun appel externe dans une transaction de base ouverte.

## Query & Resource Findings
- Toute liste est **paginée** (taille max 100 par défaut) ; pas de réponse non bornée.
- Exports volumineux asynchrones (job + notification), jamais dans la requête HTTP.
- Dashboards lus depuis `reporting` (read models), pas par agrégation sur les tables transactionnelles.
- Nettoyage planifié : jobs outbox traités, sessions expirées, tokens de rafraîchissement expirés. Partitions d'audit créées d'avance.

## Health Checks & Metrics
- `/health/live` (processus) et `/health/ready` (base joignable, migrations à jour, stockage joignable).
- Métriques RED par endpoint (débit, erreurs, durée) ; saturation du pool de connexions ; retard de l'outbox.
- Alertes sur symptômes : taux d'erreurs 5xx, latence p95, outbox > N minutes de retard, échecs de connexion en rafale (détection de force brute).
- Journaux structurés JSON avec identifiant de corrélation ; aucune donnée sensible dans les logs.

## Deploy vs Release
- Migrations **expand/contract** : ajouter d'abord, migrer, supprimer plus tard ; jamais de rupture de compatibilité en un seul déploiement.
- Feature flags pour les modules non terminés.
- Sauvegardes PostgreSQL chiffrées quotidiennes + archivage WAL (RPO cible ≤ 15 min, RTO ≤ 4 h, H) ; test de restauration trimestriel.
- Retour arrière : image Docker précédente conservée + migrations rétro-compatibles.
