# Fiche de test — RH-4 — présences déclaratives

| | |
|---|---|
| **Session** | `rh-4` |
| **Recettes de référence** | [`SPRINT-RH-4A-RECETTE.md`](../../SPRINT-RH-4A-RECETTE.md) (API, droits, base), [`SPRINT-RH-4B-RECETTE.md`](../../SPRINT-RH-4B-RECETTE.md) (écran, démonstration), [`SPRINT-RH-4C-RECETTE.md`](../../SPRINT-RH-4C-RECETTE.md) (mutants, Newman, fiches) |
| **Étiquette** | `rh-4a-validated`, `rh-4b-validated` (4c : à la validation) |
| **Contexte** | Décision D69, [ADR-0015](../../adr/0015-presences-declaratives.md) · valeurs de départ « à confirmer » avec la Direction produit · **pas de pointage** |
| **Écrans concernés** | [Présences](../interfaces/39-presences.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée des recettes** du lot : en cas de doute, la recette fait foi.*

## Avant de commencer
- Réinitialiser la pile (`node scripts/local-stack.mjs reset`, puis `--demo --rebuild`) ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : RH, Super administrateur, Direction, un employé avec compte (chargé de compte), son responsable (Responsable commercial), un employé tiers, un compte sans fiche employé.
- Le jeu de démonstration contient dix personnes avec une semaine et demie de présences ; vérifier d'abord que le bloc « presences » est chargé.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après les recettes) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Aucune surveillance | Une valeur parmi trois (sur site, télétravail, déplacement) par employé et par jour ; ni heure, ni lieu, ni retard, ni texte libre : la table et la réponse de l'API n'ont aucun champ pour cela ; une heure envoyée est refusée (400) | ☐ | |
| 2 | Une déclaration par employé et par jour | Redéclarer le même mode ne change rien et n'écrit rien dans le journal ; changer le mode écrit l'avant et l'après ; deux déclarations du même jour refusées par la base | ☐ | |
| 3 | Qui déclare pour qui | Un employé pour lui seulement ; la RH et le Super administrateur pour tous (saisie marquée « par un autre ») ; collègue, responsable, Direction : l'employé visé est « introuvable » (404, identique à un employé inexistant) | ☐ | |
| 4 | Fenêtre de saisie | Employé : 7 jours en arrière et 30 en avant, bornes comprises ; RH : 90 et 90 ; jamais avant l'entrée ni après le départ ; jamais pour un employé archivé | ☐ | |
| 5 | Cohérence avec les absences | Une absence validée sur la journée entière interdit la déclaration (409) ; une demi-journée laisse déclarer l'autre moitié ; une demande en attente ne bloque pas | ☐ | |
| 6 | Retirer une déclaration | Retire un seul jour ; audit avec l'ancienne valeur ; retirer une déclaration absente : « introuvable » | ☐ | |
| 7 | Tableau : qui voit quoi | RH, Direction, Super administrateur : tout le personnel en poste (filtre par service sans tenir compte de la casse) ; employé : sa ligne ; responsable : sa ligne et celles de ses subordonnés directs ; collègue : rien de plus que sa ligne ; compte sans fiche : aucune ligne | ☐ | |
| 8 | Tableau : période et jours d'absence | Période de 93 jours au plus, dates valides, fin après le début (un seul jour permis) ; les jours d'absence validée sont indiqués ; un week-end au milieu d'une absence n'est pas compté absent à l'écran | ☐ | |
| 9 | Compte sans fiche employé | Message clair : « Demandez à la RH de la relier » ; aucune case modifiable | ☐ | |
| 10 | Règles garanties par la base | Une seule ligne par employé et par jour (index unique), trois modes seulement, version positive, employé existant | ☐ | |
| 11 | Droits | `hr.presence.read` et `hr.presence.declare` : tout rôle déclare pour soi (Propre) ; la RH et le Super administrateur déclarent pour tous ; la RH, la Direction et le Super administrateur lisent tout ; sans jeton : 401 | ☐ | |
| 12 | Audit | Chaque création, changement et retrait écrit une ligne avec l'avant et l'après | ☐ | |
| 13 | Données de démonstration | Dix personnes, une semaine et demie ; déclarées par le compte de l'employé quand il en a un, sinon par la RH ; aucune déclaration sur le congé validé de l'agente de support | ☐ | |
| 14 | Preuves | Mutants : voir la recette 4c (tués, survivants traités) ; collection Postman (parcours 90.5) : exécutée contre une pile jetable | ☐ | |

## Écarts constatés
| Date | Vérification | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
