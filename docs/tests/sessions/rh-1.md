# Fiche de test — RH-1 — annuaire du personnel (RH légère)

| | |
|---|---|
| **Session** | `rh-1` |
| **Recette de référence** | [`SPRINT-RH-1-RECETTE.md`](../../SPRINT-RH-1-RECETTE.md) |
| **Étiquette** | — |
| **Contexte** | Branche `sprint/n1-navigation` · 2026-11-09 · décisions D55 à D59, [ADR-0009](../../adr/0009-rh-legere-dans-le-crm.md), [CADRAGE-RH](../../cadrages/CADRAGE-RH.md) |
| **Écrans concernés** | [Annuaire](../interfaces/24-annuaire.md), [Organigramme](../interfaces/25-organigramme.md), [Personnel](../interfaces/26-personnel.md), [Fiche d'un employé](../interfaces/27-fiche-employe.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi.*

## Avant de commencer
- Réinitialiser la pile (`node scripts/local-stack.mjs reset`, puis `--demo --rebuild`) : migration `20261116…` et bloc « rh » ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : RH, Direction, Responsable commercial, chargé de compte, Support, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Aucune donnée sensible | Aucun champ, aucune colonne, aucune route de salaire, naissance, adresse personnelle ou pièce d'identité ; un champ inconnu envoyé à l'API est refusé (400) | ☐ | |
| 2 | Annuaire et organigramme | Lisibles de **tout** utilisateur connecté ; personnes en poste seulement ; contacts professionnels seulement | ☐ | |
| 3 | Fiche détaillée et portée | RH et Direction : toutes ; Responsable commercial : son équipe ; autres : la leur ; hors portée = « introuvable », identique à un identifiant inexistant | ☐ | |
| 4 | Droits d'écriture | Création, modification, sortie, réintégration : RH et Super administrateur seulement | ☐ | |
| 5 | Sortie réversible | Date et motif ; la personne quitte annuaire et organigramme ; fiche gelée ; réintégration possible ; jamais de suppression (la base refuse aussi) | ☐ | |
| 6 | Hiérarchie | Pas son propre responsable ; pas de boucle ; responsable en poste ; un responsable avec des collaborateurs ne sort pas | ☐ | |
| 7 | Unicités | Matricule, e-mail professionnel et compte lié : un seul employé chacun, même en contournant l'application | ☐ | |
| 8 | Compte lié | Facultatif ; proposé par nom seulement ; jamais lié deux fois | ☐ | |
| 9 | Écarts avec la hiérarchie des comptes | Signalés à la RH et à la Direction, **jamais corrigés** ; la hiérarchie des comptes (portée « Équipe ») n'a pas bougé | ☐ | |
| 10 | Audit | Création, modification, sortie, réintégration : avant/après ; **chaque lecture détaillée tracée** | ☐ | |
| 11 | Menu | Annuaire et Organigramme pour tous ; Personnel pour la portée Tous seulement | ☐ | |
| 12 | Jeu de démonstration | 11 fiches fictives (10 en poste, 1 sortie), un seul écart (Finance), chargé seul sur une démo ancienne | ☐ | |

## Écarts constatés
| Date | Vérification | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
