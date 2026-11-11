# Fiche de test — RH-2 — absences et congés

| | |
|---|---|
| **Session** | `rh-2` |
| **Recettes de référence** | [`SPRINT-RH-2A-RECETTE.md`](../../SPRINT-RH-2A-RECETTE.md) (API), [`SPRINT-RH-2B-RECETTE.md`](../../SPRINT-RH-2B-RECETTE.md) (écrans), [`SPRINT-RH-2C-RECETTE.md`](../../SPRINT-RH-2C-RECETTE.md) (recette et mutants) |
| **Étiquette** | `rh-2a-validated`, `rh-2b-validated` |
| **Contexte** | Décision D64 (« B puis C »), [CADRAGE-RH-COMPLETE](../../cadrages/CADRAGE-RH-COMPLETE.md) · valeurs de départ « à confirmer » |
| **Écrans concernés** | [Mes absences](../interfaces/28-mes-absences.md), [Absences à valider](../interfaces/29-absences-a-valider.md), [Calendrier d'équipe](../interfaces/30-calendrier-d-equipe.md), [Soldes de congé](../interfaces/31-soldes-de-conge.md), [Paramètres des congés](../interfaces/32-parametres-des-conges.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée des recettes** du lot : en cas de doute, la recette fait foi.*

## Avant de commencer
- Réinitialiser la pile (`node scripts/local-stack.mjs reset`, puis `--demo --rebuild`) : migration `20261117…`, blocs « rh » et « conges » ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : RH, Responsable commercial, chargé de compte, Direction, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après les recettes) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Aucune donnée de santé | Aucun champ de diagnostic ni de pièce ; un motif libre et facultatif ; le type « Maladie » n'est qu'un libellé | ☐ | |
| 2 | Seul le congé annuel décompte le solde | Une maladie, une permission ou un type sans solde ne réduisent jamais le solde ; un congé annuel validé devient « pris », en attente il est réservé | ☐ | |
| 3 | Circuit de validation | Le responsable direct de l'organigramme RH (ou la RH) valide ou refuse ; refus motivé ; jamais sa propre demande ; chevauchement et solde revérifiés à la validation | ☐ | |
| 4 | Portée et « introuvable » | L'employé voit les siennes, le responsable celles de son équipe, la RH et la Direction toutes ; hors périmètre : « introuvable », identique à un identifiant inexistant | ☐ | |
| 5 | Calendrier confidentiel | Un collègue voit seulement « absent » ; le type est réservé à l'employé, son responsable, la RH et la Direction | ☐ | |
| 6 | Règles paramétrables | Taux d'acquisition, samedi, demi-journées, solde négatif, types, jours fériés : modifiables par la RH et le Super administrateur seulement, audités, aucun dans le code | ☐ | |
| 7 | Saisie par la RH | Pour un autre employé, y compris dans le passé : validée d'emblée ; la RH qui demande pour elle-même attend une autre personne | ☐ | |
| 8 | Ajustements de solde | RH seulement, motif obligatoire, ajout seul, audités | ☐ | |
| 9 | Audit | Demande, décision, annulation, ajustement, paramétrage : avant/après, auteur, session | ☐ | |
| 10 | Menu | Mes absences, Absences à valider et Calendrier pour tout employé ; Soldes et Paramètres pour la portée Tous seulement | ☐ | |
| 11 | Jeu de démonstration | Sept demandes fictives (trois en attente, trois validées, une refusée), sans donnée de santé ; chargé seul sur une démo qui a déjà le personnel | ☐ | |
| 12 | Limites assumées | Année à cheval, fuseau UTC, aucune notification, pas de suppléant, employé sans compte, règles réelles à fournir (D167 à D172, D174) | ☐ | |

## Écarts constatés
| Date | Vérification | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
