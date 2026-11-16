# ADR-0016 — Clôture de session et présences aux séances (S5.3a)

| | |
|---|---|
| **Statut** | Accepté (2026-11-16, Direction produit : « Applique les recommandations » sur l'arbitrage [ARBITRAGE-S5-3-SUIVI-PEDAGOGIQUE](../cadrages/ARBITRAGE-S5-3-SUIVI-PEDAGOGIQUE.md), option **C** en trois lots, lot **(a)** : clôture + présences). |
| **Contexte** | Dernière pièce du module Investudy avant les tableaux de bord (S6.2) : clôturer une session de formation et savoir qui était présent à chaque séance. Les formateurs sont externes, **sans compte** dans l'application (FD-11, confirmé **option B** : S1 de l'arbitrage) : ils ne saisissent jamais. |
| **Lié à** | D64 (RH complète), ADR-0009 (pas de donnée sensible), ADR-0013/0014/0015 (même méthode, RH), D70 (schémas par contexte, sans clé étrangère entre contextes) |

## Options considérées
1. **Statu quo** : pas de clôture ni de présence ; le module s'arrête aux inscriptions. Écartée (bloque S6.2).
2. **Pointage détaillé par créneau horaire** (matin/après-midi, retard chiffré, observation libre). Écartée : complexité et sensibilité des données sans besoin exprimé (cf. ADR-0015, même raisonnement que pour la RH).
3. **Une valeur par séance (retenue)** : *Présent*, *En retard*, *Absent* — un jour de cours, une ligne, par inscrit **confirmé**. Aucune heure, aucun texte libre.

## Décision
- **Clôture d'une session** (`TrainingSession.close()`) : seule une session **Ouverte** se clôture (`training.session.close`, portée Tous — Responsable Investudy, Super administrateur). Clôturée, elle ne s'annule plus et ne se modifie plus (règle déjà actée, D48/ADR antérieur) ; **les présences sont figées** : `RecordAttendanceUseCase` refuse toute écriture.
- **Réouverture** (S7) : permission **dédiée** `training.session.reopen`, jamais confondue avec `close`. **Motif obligatoire**, jamais stocké sur la session elle-même — tracé uniquement dans l'audit (avant/après + motif), à l'image du report (`postpone`).
- **Présence à une séance** (`training.Attendance`, schéma `training`) : une valeur parmi trois par **inscription confirmée** et par **jour de cours** de la session (lundi–vendredi, bornes de la session). Au plus une ligne par inscription et par jour, garanti par la base (`@@unique([enrollmentId, day])`). **Aucune heure, aucun lieu, aucun texte libre** : le modèle ne peut pas stocker de surveillance, comme pour `hr.presence_declarations` (ADR-0015) — même principe, cette fois côté Formation.
- **Qui saisit** (S1) : uniquement le responsable Investudy (et le Super administrateur), via `training.attendance.record` — jamais le formateur. Les grants `Own` du rôle Formateur sur `training.attendance.*` sont **retirés** (ils dataient d'une hypothèse où le formateur aurait eu un compte, jamais retenue).
- **Qui lit** (S8-adjacent, consultation) : responsable Investudy (Tous) et Direction (Tous, déjà dans le catalogue) ; pas d'accès chargé de compte à ce stade (la suggestion d'ambassadeur viendra au lot (c), sans lecture des présences).
- **Idempotent** : saisir la même valeur ne change rien et n'écrit rien dans le journal (comme les présences RH) ; corriger écrit l'avant et l'après, avec le dernier auteur.
- **Routes** : `POST /sessions/:id/close`, `POST /sessions/:id/reopen` (motif) ; `GET /sessions/:sessionId/attendance` (feuille complète : un inscrit confirmé par ligne, une colonne par séance) ; `PUT /sessions/:sessionId/attendance/:enrollmentId/:day` (saisir ou corriger).
- **Aucun verrou optimiste sur la présence elle-même** : comme pour `hr.presence_declarations`, la dernière saisie gagne, l'audit garde l'historique ; l'unicité de la base résout une double saisie simultanée (409 pour la seconde).

## Conséquences
- **Nouvelle table** `training.attendances`, **nouvel enum** `training.AttendanceStatus`, clé étrangère **vers `training.enrollments`** (même contexte : autorisée, D70 ne l'interdit qu'entre schémas différents).
- **Nouvelles permissions** `training.session.reopen`, `training.attendance.read`, `training.attendance.record` (déjà présentes au catalogue pour cette dernière, désormais effectivement câblées).
- **Dette ouverte, inscrite au lot (a)** : la durée de conservation des données des apprenants (présences comprises) reste sans avis juridique (D11, D65, S10) ; aucune notification à la réouverture ; le garde-fou contre l'oubli de clôture reste manuel (pas d'alerte).
- **Non couvert par ce lot** : évaluations et seuils (lot b), certificats, attestations, révocation, suggestion d'ambassadeur (lot c) — routes, écran et recette de ce lot (a) à suivre séparément (sous-lots a-écran, a-recette, comme pour RH-3/RH-4).
- **Réversibilité** : forte. `training.attendances` est une table isolée, sans clé vers un autre contexte ; `close`/`reopen` sont des transitions d'état réversibles entre elles (jamais vers `CANCELLED`).
