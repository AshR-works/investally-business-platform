# Sprint 2 — Plan de recette (Sécurité et données Core du CRM)

Statuts : ✅ vérifié · ⏳ à faire · ❌ échec · ➖ non applicable. Le sprint est validé quand tous les « Bloquant » sont ✅.

## Périmètre du sprint
Conception de la sécurité, du RBAC, de l'audit et de la traçabilité ; schéma Prisma Core ; migration ; seed des rôles et permissions. **Hors périmètre (S3)** : authentification (JWT, refresh, MFA), création du premier SuperAdmin, mise en œuvre des Guards, téléversement de documents.

## A. Conception (livrables)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| A1 | `SECURITY.md` : authentification, sessions, MFA, OWASP, incident, sauvegarde | oui | ✅ rédigé ; **validation RSSI en attente** |
| A2 | `RBAC.md` généré depuis le code (rôles, matrice, gouvernance, diagrammes ASCII + Mermaid) | oui | ✅ |
| A3 | `DATA-MODEL.md` : ERD, diagramme d'audit, diagramme de traçabilité (ASCII + Mermaid, explications, risques) | oui | ✅ |
| A4 | Points à valider avec le métier listés (`RBAC.md` §6) | oui | ✅ listés ; ⏳ réponses |

## B. Code et tests sans base
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| B1 | Types sans erreur | oui | ✅ |
| B2 | Règles d'architecture (Domain pur, frontières de module) | oui | ✅ |
| B3 | Catalogue : codes uniques, format, aucune permission d'écriture sur l'audit | oui | ✅ |
| B4 | Matrice : aucune faute de frappe, aucune permission orpheline | oui | ✅ (a détecté 2 orphelines, corrigées) |
| B5 | Séparation des tâches SuperAdmin ; gestion des comptes réservée au SuperAdmin ; Direction en lecture ; pas d'export massif hors rôles prévus | oui | ✅ |
| B6 | Règle de décision d'accès : refus par défaut, portées Own/Team/All, anti-IDOR, portée la plus large | oui | ✅ |
| B7 | Total tests unitaires | oui | ✅ 35/35 |

## C. Base de données (PostgreSQL 17 jetable, UTF-8, fuseau serveur Africa/Douala)
| # | Contrôle | Bloquant | Statut |
|---|---|---|---|
| C1 | Migrations S1 puis S2 s'appliquent sur base vide | oui | ✅ |
| C2 | Seed : tout créé, idempotent (mêmes identifiants), conforme à la matrice du code, retire l'obsolète, corrige une dérive de portée | oui | ✅ |
| C3 | Audit partitionné : ligne courante dans la partition du mois ; hors plage dans la partition de secours ; fonction idempotente | oui | ✅ |
| C4 | Audit append-only : UPDATE, DELETE, TRUNCATE refusés | oui | ✅ |
| C5 | E-mail unique parmi les comptes actifs ; réutilisable après suppression douce ; minuscules imposées ; pas son propre responsable | oui | ✅ |
| C6 | Session : expiration ≤ expiration absolue ; cascade utilisateur → sessions → jetons ; jeton unique | oui | ✅ |
| C7 | Rôle attribué non supprimable (Restrict) | oui | ✅ |
| C8 | Documents : empreinte SHA-256 valide, version unique, suppression d'un document versionné refusée | oui | ✅ |
| C9 | Aucune clé étrangère entre schémas de contextes différents | oui | ✅ |
| C10 | Total tests d'intégration (S1 + S2) | oui | ✅ 25/25 |
| C11 | Migration appliquée sur une base **déjà remplie par S1** : 40 lignes d'audit et 1 entreprise conservées à l'identique (empreinte MD5 comparée), `scripts/check-upgrade.mjs` | oui | ✅ limite : des lignes d'audit antérieures au mois précédent atterriraient dans la partition de secours (à surveiller en environnement réel) |

## D. Dette et limites connues (non bloquantes)
- Rôle PostgreSQL applicatif sans droit `UPDATE/DELETE` sur l'audit : **S7** (aujourd'hui le déclencheur est seule défense).
- Création planifiée des partitions mensuelles et alerte sur la partition de secours : **S7**.
- Aucun utilisateur n'est créé : le premier SuperAdmin sera amorcé en **S3** sans mot de passe par défaut.
- Valeurs de SECURITY.md marquées (H) à confirmer (durées de jeton, seuils de verrouillage, rétention).
- Docker, CI GitHub : toujours non exécutés (réserve F1–F3 de S1).

## Décision de validation
Validé quand : A1–A3 ✅ (✅), B ✅, C1–C10 ✅, et le métier a répondu aux points de `RBAC.md` §6 **ou** les accepte comme hypothèses de travail.
