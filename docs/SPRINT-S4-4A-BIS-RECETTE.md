# S4.4a-bis — agréments : demandé, payeur tiers, constat par la Finance ; second facteur à la réattribution : recette

*Branche `sprint/s4-4a-bis-correctifs` (partie de `main`, après S4.4b) · 2026-11-09 · décisions D41 (réponses FD-3, FD-4, FD-6) et D42 ; DDR-0026. Lot correctif : il modifie des lots déjà validés (S4.3b, S4.4a) avant S4.4c (commissions à verser), qui n'est pas livré.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **État « demandé »** | Premier état d'un agrément (promesse pas encore signée) : ni date de réception ni document obligatoire, l'entreprise ne devient pas « Cliente » ; la demande **occupe l'opportunité** ; elle **se déclare reçue** (date non future, avant la fin de validité) ou **s'annule** avec motif ; elle ne s'honore ni ne s'expire |
| **Enregistrer** | La fenêtre « Enregistrer un agrément » propose la case « La promesse n'est pas encore signée » : elle masque la date de réception et le document signé ; sans la case, le parcours de S4.4a est inchangé (agrément directement « reçu ») |
| **Déclarer reçu** | Action du menu de la ligne d'une demande : date de réception (aujourd'hui par défaut) ; l'agrément devient « reçu », l'entreprise devient « Cliente », l'événement « agrément accordé » est émis ; droit de création |
| **Payeur** | Le client par défaut ; sinon un **tiers** (nom et type : employeur, organisme, bailleur), **les deux ensemble**, affiché dans une colonne « Payeur » du panneau ; fixé à la création |
| **Constat du paiement par la Finance** | Le droit « honorer » passe du Responsable commercial à la **Finance (le DAF)**, qui reçoit aussi la lecture des agréments (portée Tous) ; le Responsable commercial garde créer et annuler |
| **Réattribution d'une entreprise** | Exige un **second facteur récent** (moins de 10 minutes) en plus de la case à cocher ; refus sans second facteur : `MFA_STEP_UP_REQUIRED`, rien n'est modifié ; l'interface redemande un code et rejoue la requête |
| **Base de données** | Migrations `20261109000000_s4_4a_bis_requested_status` (valeur d'état) et `20261109000100_s4_4a_bis_payer_and_request` (payeur, date de réception facultative, quatre contraintes recalculées) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation (235 modules) |
| Tests unitaires de l'API | **867 réussis**, 0 échec, 1 ignoré (les suites d'intégration sont ignorées dans cette passe) ; 11 nouveaux (domaine : 4 ; cas d'usage : 7 hors adaptation des tests existants) |
| **Tests d'intégration (PostgreSQL jetable)** | **352 / 352** (24 suites) ; 3 nouveaux de bout en bout (payeur tiers, demandé puis reçu, réattribution et second facteur) et 1 sonde IDOR ; règles de la base étendues ; les tests de droits suivent le nouveau partage (la Finance honore, le Responsable commercial non) |
| **IDOR** | La nouvelle route « objet » (déclarer reçu) est classée et sondée ; la sonde « honorer » s'exerce avec un compte Finance (le Responsable commercial n'en a plus le droit) ; même réponse pour l'agrément d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite |
| Règles garanties par la base | Nom et type de payeur ensemble, nom non vide ; date de réception absente seulement pour une demande ou un agrément annulé avant réception ; une demande ne double pas un agrément actif ; clôture cohérente avec les quatre états : vérifiés par des écritures directes refusées |
| Tests de l'interface | **467 / 467** (9 nouveaux) : saisie du payeur et de la demande, corps des requêtes, actions d'une demande, date de réception ; **cohérence avec le domaine réel du serveur** étendue au payeur (20 saisies) |
| **Mutants** | **23 / 23 tués** (payeur à moitié renseigné, type de payeur, nom trop long, réception d'un agrément déjà reçu, réception future, réception après la fin de validité, annulation d'une demande, événement « accordé », occupation de l'opportunité, entreprise « Cliente » à tort ou à raison, droits de la réception, demande ignorée, honorer par le Responsable commercial ou refusé à la Finance, second facteur, route de réception, date et payeur non enregistrés, contraintes de la base) ; script `scripts/mutants/s44abis-correctifs-agrements.py` |
| **Navigateur réel (Edge + axe-core)** | **Parcours ciblé** (connexion, entreprise, agréments, ambassadeurs) : **64 contrôles réussis, 0 violation** ; nouveau parcours : demande avec payeur sans type (champ en surbrillance, correction annoncée), demande avec payeur tiers listée « Demandé », déclarer reçu, honoré. Le seul ✘ est l'arrêt volontaire de fin de parcours. Résultats `docs/accessibilite/resultats/axe-2026-11-09-s44abis.json`, captures `docs/accessibilite/s44abis-captures/` |

## Défauts trouvés par la recette et corrigés
- Le test de cohérence interface ↔ serveur a montré que l'interface acceptait un type de payeur inconnu que le serveur refuse : la saisie vérifie désormais le type.
- Le contrat anti-IDOR a signalé la nouvelle route non classée avant tout autre test ; la sonde « honorer » a dû passer au compte Finance (changement de droits voulu).
- Aucun autre défaut n'a été trouvé par les tests d'intégration, les mutants ni l'audit.

## Réserves sur la recette
- **Parcours navigateur ciblé** : les écrans des lots antérieurs ne sont pas revérifiés. Trois captures d'écran n'ont pas été produites (le navigateur sans fenêtre ne répond pas à la capture, sans effet sur les contrôles).
- **Les rôles autres que le Super administrateur ne sont pas parcourus dans le navigateur** : le constat par la Finance et le refus du Responsable commercial sont couverts par les tests d'intégration, l'IDOR et les mutants, pas par l'audit navigateur.
- **La Finance ne voit les agréments que depuis la fiche d'une entreprise** (pas de page d'ensemble des agréments à constater, D128).
- Le payeur et la demande ne se modifient pas après la création (D125, D126) ; le type de payeur est une liste fermée (D127) ; le second facteur de la réattribution est celui de toutes les actions sensibles (D129).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22. Le prototype n'est pas à jour (D49).

## Dette et à confirmer
- **D125 à D129** (`docs/TECH-DEBT.md`) ; **D111** soldée, **D112** précisée.
- **D42 — à confirmer** : demande sans date ni document, entreprise « Cliente » à la réception, honorer réservé à la Finance (le Responsable commercial perd ce droit), payeur tiers fixé à la création, second facteur à la réattribution.
- **D39 et D37 sont révisées par D41** : l'état « demandé » et le second facteur remplacent respectivement « pas d'état demandé » et « confirmation par case à cocher seulement ».

## À valider
1. Les écrans (demande, payeur tiers, déclarer reçu, colonne « Payeur ») et les valeurs par défaut de D42.
2. « Je valide S4.4a-bis » → fusion avec commit de fusion et étiquette `s4-4a-bis-validated`.
