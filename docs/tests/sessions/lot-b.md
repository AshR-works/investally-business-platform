# Fiche de test — Lot B — apprenant étudiant ou particulier

| | |
|---|---|
| **Session** | `lot-b` |
| **Recette de référence** | [`SPRINT-LOT-B-RECETTE.md`](../../SPRINT-LOT-B-RECETTE.md) |
| **Étiquette** | `lot-b-validated` |
| **Contexte** | Décision D65 (option C), [ADR-0011](../../adr/0011-apprenant-sans-entreprise-et-payeur-designe.md) |
| **Écrans concernés** | [Apprenants](../interfaces/21-apprenants.md), [Inscriptions](../interfaces/22-inscriptions.md), [Fiche d'une session](../interfaces/23-fiche-session.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi.*

## Avant de commencer
- Réinitialiser la pile (`node scripts/local-stack.mjs reset`, puis `--demo --rebuild`) : migration `20261118…` et bloc « particuliers » (3 apprenants, 3 inscriptions) ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : Responsable Investudy, Support, Direction, Finance, chargé de compte, Responsable commercial.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Aucun accès pour les apprenants | Aucun compte d'apprenant, aucun écran ni droit pour un apprenant : ce sont des fiches saisies par des employés | ☐ | |
| 2 | Étudiant et particulier sans entreprise | Ni entreprise, ni contact, ni agrément ; nature « Étudiant » ou « Particulier » ; la base refuse une fiche incohérente | ☐ | |
| 3 | Payeur désigné à chaque inscription | L'apprenant lui-même, ou un tiers nommé avec sa nature (employeur, organisme, bailleur, famille ou proche) ; jamais les deux formes (agrément et payeur) | ☐ | |
| 4 | Montant dû | Prix complet du certificat, recopié sur l'inscription ; un certificat sans prix ne s'inscrit pas | ☐ | |
| 5 | Visibilité | Responsable Investudy, Support, Direction, Finance (inscriptions) : visibles ; chargé de compte et Responsable commercial : « introuvable » ; création réservée à ceux qui gèrent tout | ☐ | |
| 6 | Règles communes inchangées | Une place, pas deux fois la même session, pas de session qui recouvre, confirmation, annulation motivée, replacement (garde le payeur) | ☐ | |
| 7 | Apprenants d'entreprise inchangés | Agrément exigé et contrôlé ; aucun payeur désigné ; places et sommes consommées comme avant | ☐ | |
| 8 | Doublon | Signalé parmi les étudiants et particuliers, pas contre un apprenant d'entreprise ; « Créer quand même » | ☐ | |
| 9 | Interface | Case « Sans entreprise » qui désactive l'entreprise, liste Étudiant / Particulier ; choix du payeur à l'inscription ; filtre par nature ; pastille de nature dans les listes | ☐ | |
| 10 | Jeu de démonstration | 2 étudiants et 1 particulier ; 3 inscriptions (lui-même, famille, employeur), 2 confirmées ; chargé seul sur une démo existante | ☐ | |
| 11 | Limites assumées | Règlement non suivi, pas de tarif étudiant, étudiants invisibles pour les commerciaux (D175, D176) | ☐ | |

## Écarts constatés
| Date | Vérification | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
