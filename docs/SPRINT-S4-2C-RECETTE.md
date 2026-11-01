# S4.2c — relances des offres : recette

*Branche `sprint/s4-2c-relances` (partie de `sprint/s4-2b-decharges`) · 2026-11-03 · cas d'usage CU-C-22 ; flux C2 ; DDR-0019 ; décision D34. Dernier des trois lots de S4.2 : offres (S4.2a, validé), décharges (S4.2b, en attente), relances (ce lot).*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Page « Relances »** | Nouveau module de la navigation : liste triée par échéance, filtres rapides **À faire, En retard, Aujourd'hui, À venir, Terminées, Annulées**, sélection persistante, pagination |
| **Planifier** | Offre (imposée depuis son menu, ou choisie parmi les offres en cours), échéance proposée à **sept jours**, canal (Appel, E-mail, WhatsApp, Rencontre, Autre), note ; seulement sur une offre **déposée ou à décharge reçue** |
| **Au plus trois relances par offre** | Une relance annulée libère une place |
| **En retard** | Calculé à la lecture (échéance dépassée, relance à faire), signalé par un badge ; une relance en retard peut être terminée ou modifiée sans changer son échéance passée |
| **Terminer / annuler** | **Résultat obligatoire** pour terminer, **motif obligatoire** pour annuler ; définitives ; historique visible dans les filtres |
| **Avec l'offre** | Acceptée, refusée ou retirée : les relances à faire sont **annulées automatiquement** (motif écrit, une trace d'audit par relance, même transaction) |
| **Depuis les offres** | Action « Relances » dans le menu d'une offre (page filtrée sur l'offre) ; colonne **« Prochaine relance »** dans la liste des offres et la fiche entreprise |
| **Droits et audit** | Chargé de compte (Propre), Responsable commercial (Équipe), Direction en lecture ; planification, modification, clôture et annulation automatique tracées avec la session |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (199 modules) |
| Tests unitaires de l'API | **679 / 679** (1 ignoré, antérieur) ; 53 nouveaux (relance : 25 ; cas d'usage : 28) |
| **Tests d'intégration (PostgreSQL jetable)** | **268 / 268** (19 suites) ; 17 nouveaux : 11 de bout en bout (cycle, refus, limite de trois, retard calculé, tri et portée, annulation avec l'offre, droits, règles de la base, verrou optimiste au niveau de la base, entreprise archivée, audit) et 6 sondes IDOR |
| **IDOR** | Les six routes de relance sont classées « objet » et sondées : même réponse pour la relance d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite ; la relance de Marie reste « à faire », version 1, après les tentatives |
| Règles garanties par la base | Une relance à faire n'est pas close ; une relance close a sa date et son texte ensemble ; version positive : vérifiées par des écritures directes refusées |
| Tests de l'interface | **308 / 308** (27 nouveaux) : dates, saisie, corps des requêtes, filtres, actions selon l'état et les droits ; **cohérence avec le domaine réel du serveur** sur 15 saisies |
| **Mutants** | **15 / 15 tués** (échéance passée, limite de trois, relance sur une offre sans réponse attendue, relances annulées comptées, annulation à l'acceptation, relances terminées aussi annulées, retard du jour, échéance passée conservée, résultat vide, droit de la route, portée de la liste, cohérence de la base, tri inversé, prochaine relance, verrou optimiste) |
| **Navigateur réel (Edge + axe-core)** | Parcours limité aux offres, aux décharges et aux relances : **77 contrôles réussis, aucun échec** (dont tous ceux des relances : échéance refusée avec focus, liste, résultat obligatoire, relance terminée, annulation avec l'offre retirée) ; résultats `docs/accessibilite/resultats/axe-2026-11-03-s42c.json`, captures `docs/accessibilite/s42c-captures/` |

## Défauts trouvés par la recette et corrigés
- **Le menu d'une offre retirée n'était plus vide** : il propose maintenant la consultation (décharge, relances, documents) ; les attentes de l'audit ont été mises à jour, pas le comportement.
- **Mesures de mutants parasitées par la machine** : une adresse réseau de la base de test restait occupée par un processus disparu (Windows) ; les cinq derniers mutants ont été rejoués sur un autre port, tous tués.

## Réserves sur la recette
- **Le parcours navigateur complet n'a pas été mené à son terme** : le navigateur sans fenêtre de la machine reste instable (captures et chargements qui n'aboutissent pas). Une première exécution complète a réussi les relances puis s'est arrêtée sur une attente de menu corrigée depuis ; une deuxième s'est arrêtée sur un contrôle d'un lot précédent ; la troisième, limitée aux offres, décharges et relances, est complète et réussie. Les écrans des lots précédents situés après les relances ne sont donc **pas** revérifiés par ce lot. Quatre captures n'ont pas pu être produites (dont la liste des relances).
- **Pas de planification automatique après le dépôt** (D80) ni de rappel envoyé à l'échéance (D82) : la liste « À faire » est le seul signal avant l'agenda (S4.2d).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22.
- Cette branche dépend de `sprint/s4-2b-decharges` (PR 24, en attente de validation) : **elle ne peut être fusionnée qu'après elle**. Le prototype et le wireframe 16 ne sont pas à jour (D49).

## Dette et à confirmer
- **D80 à D84** (`docs/TECH-DEBT.md`).
- **D34 — à confirmer** : délai de sept jours, limite de trois relances, planification automatique au dépôt.

## À valider
1. Les écrans (page Relances, fenêtres de planification et de clôture, colonne « Prochaine relance ») et les valeurs par défaut de D34.
2. « Je valide S4.2c » → fusion avec commit de fusion et étiquette `s4-2c-validated` (après S4.2b).
