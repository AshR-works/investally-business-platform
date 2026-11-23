# ADR-0017 — Évaluations et seuils d'éligibilité (S5.3b)

| | |
|---|---|
| **Statut** | Accepté (2026-11-16, Direction produit : « Applique les recommandations » sur l'arbitrage [ARBITRAGE-S5-3-SUIVI-PEDAGOGIQUE](../cadrages/ARBITRAGE-S5-3-SUIVI-PEDAGOGIQUE.md), option **C** en trois lots, lot **(b)** : évaluations + seuils). |
| **Contexte** | Après la clôture et les présences (lot a, ADR-0016), ce lot ajoute la **note** d'un inscrit et **calcule** une suggestion d'éligibilité à un certificat ou une attestation (CU-I-60) — sans jamais la délivrer (lot c). |
| **Lié à** | ADR-0016 (même méthode, mêmes principes), D72 (décision de l'arbitrage, sous-décisions S4/S5), D11/D65 (avis juridique différé, S10) |

## Options considérées
1. **Barème détaillé** (acquis/non acquis par compétence). Écartée (S4 de l'arbitrage) : complexité sans besoin exprimé, pas de commentaire libre souhaité (même raisonnement que les présences, ADR-0016).
2. **Note sur 20, sans commentaire libre (retenue, S4)** : une valeur numérique par inscrit confirmé, au plus une par inscription.
3. **Délivrance automatique dès les seuils atteints**. Écartée (S6) : la délivrance reste **suggérée puis manuelle**, décidée par le responsable Investudy — hors périmètre de ce lot (b), qui se limite au **calcul**.

## Décision
- **Évaluation** (`training.Evaluation`, schéma `training`) : une **note sur 20** (deux décimales au plus), au plus une par **inscription confirmée**, sans commentaire libre (S4). Figée dès que la session est clôturée (comme la présence, S7 pour la réouverture).
- **Qui saisit** (S1, même règle que la présence) : uniquement le responsable Investudy (et le Super administrateur), via `training.evaluation.record` — jamais le formateur. Les grants du rôle Formateur sur `training.evaluation.*` sont **retirés** (même hypothèse jamais retenue d'un compte formateur que pour la présence, ADR-0016).
- **Qui lit** : responsable Investudy et Direction (portée Tous) ; pas d'accès chargé de compte à ce stade (comme pour la présence).
- **Idempotent** : resaisir la même note ne change rien et n'écrit rien dans le journal ; corriger écrit l'avant et l'après, avec le dernier auteur retenu **en base** (aucun verrou optimiste exposé par l'API, même principe que la présence : « la dernière saisie gagne »).
- **Seuils d'éligibilité** (`training.TrainingThresholds`, S5, D31) : une **seule ligne**, **paramétrable** (comme les réglages de congés), valeurs de départ « à confirmer » — taux de présence minimal (80 % par défaut) et note minimale (10/20 par défaut). Modifiables via `training.evaluation.manage` (nouvelle action du catalogue), avec verrou optimiste et trace d'audit.
- **Calcul de l'éligibilité** (CU-I-60, fonction pure `computeEligibility`) : **certificat** si le taux de présence **et** la note atteignent les deux seuils ; **attestation** si seul le taux de présence est atteint (note absente ou insuffisante) ; sinon **aucune suggestion**. Le taux de présence suit la règle déjà décidée (S3, ADR-0016) : un retard compte comme présent.
- **Un calcul, jamais une délivrance** : la feuille d'évaluation (`GET /sessions/:sessionId/evaluations`) affiche la suggestion ; aucune table ni aucun état de certification n'existe dans ce lot (lot c : CU-I-60/61, délivrance et révocation).
- **Routes** : `GET /sessions/:sessionId/evaluations` (feuille : note, taux de présence, suggestion, par inscrit confirmé) ; `PUT /sessions/:sessionId/evaluations/:enrollmentId` (saisir ou corriger) ; `GET`/`PUT /training/thresholds` (réglages des seuils).

## Conséquences
- **Nouvelles tables** `training.evaluations` (unique par inscription, clé étrangère vers `training.enrollments`, même contexte) et `training.training_thresholds` (une seule ligne, comme `hr.leave_settings`).
- **Nouvelle action** `training.evaluation.manage` au catalogue (seuils) ; `training.evaluation.read`/`.record` déjà présentes, désormais effectivement câblées et **retirées du rôle Formateur** (correction : elles y figuraient encore après le retrait des mêmes grants de présence en S5.3a — même hypothèse jamais retenue, oubliée à l'époque).
- **Classification du risque pour la recette (D73)** : ce lot est classé **à risque réel** — un seuil mal calculé suggère à tort un certificat ou une attestation, un effet qui ne serait détecté par personne sans test dédié (la délivrance reste manuelle, lot c, mais une suggestion fausse oriente une décision humaine qui ne revérifie pas le calcul). La recette de ce lot (sous-lot b-recette) comportera donc des mutants et une exécution Newman, comme pour S5.3a.
- **Dette non ajoutée, déjà ouverte** : la durée de conservation des données des apprenants (notes comprises) reste sans avis juridique (D11, D65, S10, déjà inscrite au lot a).
- **Non couvert par ce lot** : certificats, attestations, révocation, numérotation, suggestion d'ambassadeur (lot c) — écran et démonstration (sous-lot b-écran), puis recette (sous-lot b-recette) à suivre séparément, comme pour le lot (a).
- **Réversibilité** : forte. `training.evaluations` et `training.training_thresholds` sont des tables isolées, sans clé vers un autre contexte ; les seuils sont des valeurs modifiables, pas du code.
