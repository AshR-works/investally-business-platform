# ADR-0006 — Décisions d'accès et de sécurité du 2026-10-20

- **Statut** : Accepté (décisions de la direction produit, 2026-10-20)
- **Décideurs** : Direction produit, Tech Lead
- **Remplace** : la recommandation de séparation des tâches du SuperAdmin (RBAC.md, première version)

## Contexte
Fin du Sprint 2, la direction a tranché les questions ouvertes de conception. Environ 20 utilisateurs au démarrage (10 employés aujourd'hui).

## Décisions
| # | Décision | Garde-fou / conséquence |
|---|---|---|
| 1 | Rôle `TRAINING_MANAGER` (Responsable Investudy) ajouté | Déjà dans la matrice ; sans lui personne ne gère programmes et sessions |
| 2 | **SuperAdmin : accès complet** (toutes permissions, portée Tous) | Compte à très haut risque. Compensations : MFA obligatoire, step-up pour les actions sensibles, interdiction de modifier ses propres rôles, au moins deux SuperAdmin nominatifs, audit de toutes ses actions, revue trimestrielle (SECURITY.md §2.5). Le « bris de glace » devient inutile |
| 3 | Portée Équipe = subordonnés directs (un niveau, `managerId`) | Une couche hiérarchique supplémentaire exigera des requêtes récursives |
| 4 | **MFA obligatoire pour tous les rôles** (TOTP) | Enrôlement forcé à la première connexion ; codes de secours ; procédure de réinitialisation par un SuperAdmin avec step-up. *Interprétation : « MFA obligatoire » sans distinction vaut pour tout le monde* |
| 5 | Durées : jeton d'accès 15 min, inactivité 8 h, absolu 7 jours (12 h pour SuperAdmin, Direction, Finance) | Configurables par environnement |
| 6 | E-mail via **Microsoft 365** | API Graph recommandée (retrait progressif de l'authentification basique SMTP) ; adaptateur derrière un port ; à confirmer avec l'administrateur M365 |
| 7 | Audit conservé **10 ans** | 2 ans en ligne puis archivage à froid (recommandation) ; validation juridique à obtenir |
| 8 | Agrément formation = promesse de paiement (propriété de Business Development) | Voir ARCHITECTURE.md |
| 9 | Plusieurs opportunités par entreprise ; apprenant sans accès au CRM ; ambassadeur manuel ; dérogation du Responsable commercial à la règle du RDV décideur (justifiée, auditée) | Voir ARCHITECTURE.md |
| 10 | Recommandations appliquées pour : Support en lecture seule, Direction lit l'audit (lectures auditées), XAF par défaut, pas de suivi de paiement dans le CRM, charge ≈ 20 utilisateurs | |

## Conséquences
- (+) Exploitation simple pour une petite équipe : un administrateur sait tout faire.
- (−) Un compte SuperAdmin compromis expose **toutes** les données du CRM. La protection repose sur le MFA, le nombre réduit de comptes et la surveillance, pas sur la séparation des tâches.
- (−) MFA pour tous : support en cas de téléphone perdu ; prévoir une procédure de réinitialisation et la communication aux utilisateurs.
- Les tests automatisés vérifient : SuperAdmin = toutes les permissions ; MFA exigé pour tous les rôles ; la gestion des comptes reste réservée au SuperAdmin.

## À revoir si
L'effectif dépasse ~50 utilisateurs, si un audit externe l'exige, ou si le périmètre inclut des données bancaires : réintroduire la séparation des tâches (rôle d'administration technique sans accès métier).
