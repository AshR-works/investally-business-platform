# DDR-0023 — Valeur des opportunités au tableau des entreprises ; rendez-vous lié à une opportunité

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-07 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.3c ; cas d'usage CU-C-30 et CU-C-43 ; flux C3, C4 et F1 ; décisions D93, D104 et D38 |

## Contexte
Deux manques restaient de S4.3. Le tableau des entreprises ne disait pas ce qu'elles représentent : on ne voyait pas, d'un coup d'œil, combien d'opportunités sont ouvertes ni pour quel montant. Et la règle de l'accord de principe comptait **n'importe quel** rendez-vous décideur tenu avec l'entreprise : un rendez-vous tenu pour une opportunité en débloquait aussi une autre, sans rapport (D93). Ce lot ajoute la colonne « Valeur » et le lien d'un rendez-vous à une opportunité. Les valeurs retenues sont **à confirmer** (D38).

## Décisions
1. **Colonne « Valeur »** du tableau des entreprises, visible par défaut, juste après « Responsable » : le **nombre** d'opportunités **ouvertes** et leur **valeur**, par exemple « 3 · 3 000 000,50 FCFA ». Les opportunités gagnées ou perdues ne comptent pas.
2. **Jamais deux devises additionnées** : plusieurs devises s'affichent l'une après l'autre (« 2 · 300,25 € + 1 000 000 FCFA »).
3. **Visible seulement de qui peut lire les opportunités**, et dans la même portée : le chargé de compte voit la valeur de **ses** entreprises, le Responsable commercial et la Direction celle de **toutes**. Un rôle qui voit les entreprises sans le droit de lire les opportunités (Support, Finance) a la cellule vide : le serveur ne calcule même pas la valeur.
4. **Le montant est une estimation non pondérée** : aucune probabilité n'est appliquée. La colonne ne se trie ni ne se filtre dans cette version.
5. **Rendez-vous lié à une opportunité** (facultatif) : à la planification, un choix « Opportunité liée » propose les opportunités **ouvertes de l'entreprise** ; une opportunité d'une autre entreprise, inconnue ou déjà clôturée est refusée. Le lien est **posé à la planification et ne change plus** (comme l'offre liée).
6. **Règle de l'accord de principe, précisée (D93)** : pour une opportunité, comptent les rendez-vous décideur **tenus** qui lui sont **liés** ET ceux qui ne sont liés à **aucune** opportunité (rendez-vous « de l'entreprise »). Un rendez-vous lié à une **autre** opportunité ne compte **pas**. La dérogation reste possible.
7. **Rendez-vous existants** : ceux planifiés avant ce lot ne sont liés à rien ; ils continuent donc de compter pour toutes les opportunités de leur entreprise (comportement de transition, sans rupture).
8. **Lecture** : le lien et l'intitulé de l'opportunité apparaissent dans la fiche du rendez-vous et dans les listes ; le lien est tracé dans l'audit à la planification.

## Mesures de rigueur
- Une migration ajoute la colonne et sa **clé étrangère** ; la base refuse un lien vers une opportunité inexistante (vérifié par une écriture directe refusée).
- La règle D93 est couverte de bout en bout (HTTP + PostgreSQL) : lié à une autre opportunité → refusé ; lié à elle ou non lié → accepté.
- Le périmètre de la valeur est couvert par des tests unitaires et d'intégration, dont le cas du rôle sans droit de lecture des opportunités.
- Les mutants (fautes injectées) sont tous détectés (voir la recette).

## Conséquences
- Réversible : une colonne facultative, un port de lecture, une colonne de tableau, un champ de formulaire.
- **Dette** : D106 à D110 (`docs/TECH-DEBT.md`) ; D93 et D104 soldées.
