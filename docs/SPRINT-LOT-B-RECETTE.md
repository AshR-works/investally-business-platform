# Lot B — apprenant étudiant ou particulier : recette

*Branche `feat/lot-b-apprenant-particulier` · 2026-11-11 · décision **D65** (option C de l'arbitrage du 2026-11-11, « applique les recommandations »), [ADR-0011](adr/0011-apprenant-sans-entreprise-et-payeur-designe.md) · **Les apprenants n'ont pas accès à la plateforme** : ce sont des fiches saisies par les employés.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Apprenant sans entreprise** | Nature `Étudiant` ou `Particulier`, sans entreprise, contact ni agrément ; les apprenants existants restent « d'une entreprise » ; la **base** refuse une fiche incohérente |
| **Payeur désigné** | À chaque inscription d'un apprenant sans entreprise : **lui-même** ou un **tiers** (nom et nature : employeur, organisme, bailleur, **famille ou proche**) ; jamais un agrément en même temps ; le **montant dû est le prix complet** du certificat (recopié) ; un certificat sans prix ne s'inscrit pas |
| **Règles communes** | Place, pas deux fois la même session, pas de session qui recouvre, doublon, confirmation, annulation motivée, replacement (qui **garde le payeur**) : inchangés |
| **Visibilité** | Un étudiant ou un particulier est un objet **sans propriétaire** : visible et gérable seulement avec la portée **Tous** (Responsable Investudy, Support et Direction en lecture, Finance pour les inscriptions, Super administrateur) ; chargé de compte et Responsable commercial : « introuvable » ; création : réservée à ceux qui gèrent tout. **Aucune nouvelle permission** |
| **Interface** | Case **« Sans entreprise (étudiant ou particulier) »** qui désactive l'entreprise et ouvre la liste Étudiant / Particulier ; à l'inscription, **choix du payeur** à la place de l'agrément ; filtre « Tous / Entreprises / Étudiants / Particuliers » ; pastille de nature ; colonne « Agrément ou payeur » avec le montant dû |
| **Démonstration** | Bloc « particuliers » : 2 étudiants (l'un règle lui-même, pour l'autre c'est sa famille) et 1 particulier (son employeur règle), 3 inscriptions dont 2 confirmées ; se charge seul sur une démo existante |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types | `tsc` propre (API et interface) |
| Tests unitaires de l'API | Domaine de la formation : **112 réussis**, dont 16 nouveaux (`learner-individual.spec`) : création et incohérences, visibilité par rôle, filtre par nature, doublon, payeur (lui-même, tiers, refus), certificat sans prix, règles communes, confirmation / annulation / replacement, aucune offre d'agrément ; plan de démonstration : 4 nouveaux |
| Tests de l'interface | **760 réussis** (39 fichiers), dont `lot-b-particuliers.test` qui interroge le **domaine réel du serveur** sur la nature et le payeur |
| Intégration (base jetable) | `particuliers-http` (**4** tests : parcours étudiant et particulier avec audit, refus de payeur mal désigné, portée par rôle, **règles de la base**), plus `enrollments-http`, `core-schema`, `idor-contract` et `seed-demo` (10) : verts |
| Base | Migration `20261118000000_lot_b_apprenant_particulier` : colonne `kind`, `company_id` et `approval_id` facultatifs, payeur ; **deux règles garanties par la base** (`learners_kind_company_coherent`, `enrollments_payer_coherent`) ; aucune clé étrangère vers un autre schéma |

## Limites connues (dettes D175 et D176)
- **Le règlement n'est pas suivi** : seul le montant dû est enregistré ; le prix est le prix complet, **sans tarif étudiant** (à fournir). À relier à la facturation avec le module Facturation et paiements.
- Un chargé de compte ou un Responsable commercial **ne voit pas** les étudiants et particuliers (pas de propriétaire).
- Mode sombre, 1280 et 1920 px, clavier : à contrôler (comme les lots précédents). Aucun mutant n'a été lancé sur ce lot.

## Comment vérifier
1. Démarrer la pile avec démonstration (`node scripts/local-stack.mjs --demo`) : sur une démo existante, seul le bloc « particuliers » est ajouté.
2. Rejouer la fiche de session `docs/tests/sessions/lot-b.md` et les scénarios 10 à 13 de la fiche « Apprenants », B1 à B6 de la fiche « Inscriptions ».
