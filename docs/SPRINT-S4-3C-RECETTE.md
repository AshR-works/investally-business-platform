# S4.3c — valeur des opportunités et lien rendez-vous ↔ opportunité : recette

*Branche `sprint/s4-3c-valeur-lien-rdv` (partie de `main`, après S4.3b) · 2026-11-07 · cas d'usage CU-C-30 et CU-C-43 ; flux C3, C4 et F1 ; DDR-0023 ; décisions D93, D104 et D38. Dernier lot de la session S4.3.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Colonne « Valeur »** | Au tableau des entreprises, visible par défaut après « Responsable » : le **nombre** d'opportunités **ouvertes** et leur **valeur**, par exemple « 1 · 4 000 000 FCFA » ; gagnées et perdues ne comptent pas |
| **Devises** | **Jamais additionnées** : plusieurs devises s'écrivent l'une après l'autre |
| **Droit de lecture** | La valeur suit la portée de **lecture des opportunités** : le chargé de compte voit celle de ses entreprises, le Responsable commercial et la Direction celle de toutes ; un rôle qui voit les entreprises **sans** pouvoir lire les opportunités (Support, Finance) a la cellule vide, le serveur ne la calcule même pas |
| **Rendez-vous lié** | Dans la fenêtre de planification, « Opportunité liée (facultatif) » propose les opportunités **ouvertes de l'entreprise**, avec une aide écrite ; refus si l'opportunité est d'une autre entreprise, inconnue ou clôturée ; le lien est posé à la planification et **ne change plus** |
| **Règle de l'accord de principe (D93)** | Comptent les rendez-vous décideur **tenus** liés à **cette** opportunité ou **non liés** ; un rendez-vous lié à une **autre** opportunité ne compte plus |
| **Lecture** | L'intitulé de l'opportunité figure dans la fiche du rendez-vous et dans les listes ; le lien est tracé dans l'audit |
| **Base de données** | Une migration ajoute la colonne facultative et sa **clé étrangère** |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation (219 modules) |
| Tests unitaires de l'API | **804 réussis**, 0 échec (les suites d'intégration, qui exigent la base, sont ignorées dans cette passe) ; 7 nouveaux (lien du rendez-vous : 2 ; règle D93 : 1 ; valeur dans la liste : 4) |
| **Tests d'intégration (PostgreSQL jetable)** | **322 / 322** (22 suites) ; 3 nouveaux de bout en bout : lien accepté ou refusé (autre entreprise, clôturée, inconnue, identifiant mal écrit) et immuable ; **règle D93** (lié à une autre opportunité : refusé ; lié à elle ou non lié : accepté) ; **valeur** par devise, opportunités perdues exclues, portée du chef et du collègue, rôle sans droit de lecture ; et une écriture directe refusée par la clé étrangère |
| **IDOR** | Les routes sont inchangées (le lien se contrôle contre l'entreprise de l'appelant, donc hors portée l'opportunité est refusée) ; le contrat anti-IDOR reste vert |
| Tests de l'interface | **408 / 408** (8 nouveaux) : lien dans la requête de planification (jamais renvoyé à la modification), reconstitution du formulaire, colonne « Valeur » (affichage d'une ou de plusieurs devises, vide sans droit ou sans opportunité ouverte) |
| **Mutants** | **14 / 14 tués** (rendez-vous non lié ignoré, lié à une autre opportunité compté, opportunité d'une autre entreprise, clôturée ou inconnue acceptée, lien non transmis, intitulé absent de l'agenda et de la fiche, lien non enregistré, opportunités clôturées comptées, valeur hors du droit de lecture, portée de la valeur sur le droit des entreprises, clé étrangère absente, identifiant non validé) |
| **Navigateur réel (Edge + axe-core)** | **Parcours ciblé** (connexion, création d'une entreprise, fiche, puis ce lot) : **43 contrôles réussis, aucun échec, 0 violation** ; la colonne « Valeur » annonce « 1 · 4 000 000 » après la création d'une opportunité depuis la fiche, et la planification propose l'opportunité liée avec son aide. Le seul ✘ est l'arrêt volontaire de fin de parcours. Résultats `docs/accessibilite/resultats/axe-2026-11-07-s43c.json`, captures `docs/accessibilite/s43c-captures/` |

## Défauts trouvés par la recette et corrigés
- Aucun défaut de l'application n'a été trouvé par les tests, les mutants ni l'audit sur ce lot.
- **Hors lot** : les doublures de test du dépôt de rendez-vous et du dépôt d'opportunités ont dû suivre le nouveau lien (mise à jour sans changement de comportement).

## Réserves sur la recette
- **Parcours navigateur ciblé** : les écrans des lots antérieurs ne sont pas revérifiés par ce lot (voir la recette de S4.3b pour l'instabilité du navigateur sans fenêtre dans l'agenda).
- **Une capture manquante** : « entreprises-valeur » (le contrôle a réussi, le navigateur n'a pas répondu à la capture) ; la capture du formulaire de rendez-vous lié est fournie.
- **Rendez-vous lié non mené jusqu'à son terme dans le navigateur** : l'audit enregistre un rendez-vous décideur lié, mais la vérification que la règle D93 s'applique ensuite est couverte par les tests d'intégration et les mutants, pas par le navigateur.
- **Rendez-vous antérieurs non liés** : ils comptent encore pour toutes les opportunités de leur entreprise (D106) ; le lien ne se modifie pas après coup.
- **Valeur non pondérée, non triable** (D107) ; pas d'action « Planifier » depuis une opportunité (D108) ; une seule opportunité par rendez-vous (D109) ; pas de total général de la liste (D110).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22. Le prototype n'est pas à jour (D49).

## Dette et à confirmer
- **D106 à D110** (`docs/TECH-DEBT.md`) ; D93 et D104 soldées.
- **D38 — à confirmer** : colonne « Valeur » (ouvertes, par devise, selon le droit de lecture, non pondérée), lien facultatif non modifiable, règle D93, rendez-vous antérieurs non liés.

## À valider
1. Les écrans (colonne « Valeur », choix « Opportunité liée » dans la planification, intitulé rappelé dans la fiche du rendez-vous) et les valeurs par défaut de D38.
2. « Je valide S4.3c » → fusion avec commit de fusion et étiquette `s4-3c-validated`.
