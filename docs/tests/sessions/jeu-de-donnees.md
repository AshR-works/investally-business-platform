# Fiche de test — Jeu de données de démonstration (module commercial)

| | |
|---|---|
| **Session** | `jeu-de-donnees` |
| **Recette de référence** | [`SPRINT-JEU-DE-DONNEES-RECETTE.md`](../../SPRINT-JEU-DE-DONNEES-RECETTE.md) |
| **Étiquette** | — |
| **Contexte** | Branche `sprint/jeu-de-donnees-demo` (partie de la branche S4.4a-bis : le jeu emploie l'agrément « demandé » et le payeur tiers) · 2026-11-03 · tâches T4.1 à T4.4 de `docs/cadrages/OBSERVATIONS-VALIDATION-UX-ET-DONNEES-DE-TEST.md`. Aucun changement d'architecture, de droits ni de modèle de données ; aucun document, contrat, attestation, facture, fichier joint ni certificat n'est généré. |
| **Écrans concernés** | [Entreprises (tableau)](../interfaces/10-entreprises.md), [Fiche d'une entreprise](../interfaces/11-fiche-entreprise.md), [Contacts](../interfaces/12-contacts.md), [Offres](../interfaces/13-offres.md), [Relances](../interfaces/14-relances.md), [Agenda (rendez-vous et visites)](../interfaces/15-agenda.md), [Opportunités (pipeline)](../interfaces/16-opportunites.md), [Ambassadeurs](../interfaces/17-ambassadeurs.md) |

*Fiche de session de la [charte de tests](../../CHARTE-DE-TESTS.md), **dérivée de la recette** du lot : en cas de doute, la recette fait foi. Elle sert à rejouer la recette utilisateur et à vérifier l'absence de régression.*

## Avant de commencer
- Pile locale lancée (`node scripts/local-stack.mjs --demo`) ou pile jetable ; comptes de démonstration (mots de passe dans le fichier local, jamais dans le dépôt).
- Rôles utiles : chargé de compte, Responsable commercial (avec son équipe), Direction, Super administrateur.

## Vérifications à rejouer
| N° | Vérification | Résultat attendu (d'après la recette) | Constaté (✔ / ✘) | Date et initiales |
|---|---|---|---|---|
| 1 | Quarante entreprises fictives | Banques, microfinance, fintechs, assurances, sociétés de gestion de patrimoine, sociétés de bourse, télécoms, industries, énergie, PME et grandes entreprises ; Cameroun, Côte d'Ivoire, Sénégal, Gabon, RDC ; noms **inventés** (aucune marque réelle) ; créées **sur douze mois** (de novembre 2025 à octobre 2026) | ☐ | |
| 2 | Vie commerciale complète | 559 événements en dix scénarios en rotation (de l'entreprise « cible » seule à la cliente avec ambassadeur) : 84 contacts, 68 changements de statut, 59 rendez-vous (tenus, annulés, à venir), 36 offres (brouillon, déposées, décharge reçue, acceptées, refusées, retirées), 28 décharges, 11 relances (faites, **en retard**, **à venir**), 24 opportunités (de « Qualification » à « Agrément » ; perdues, gagnées, … | ☐ | |
| 3 | Passe par les vrais cas d'usage | Mêmes règles que l'interface (validation, états, versions, portée, audit) ; l'horloge est avancée de date en date : chaque objet a **sa vraie date de création** ; chaque action est faite **par le bon rôle** (chargé de compte propriétaire, Responsable commercial pour les dérogations, les gains et les annulations d'agrément, Finance pour constater le paiement) | ☐ | |
| 4 | Équipe | Un troisième chargé de compte (`compte3@`) s'ajoute aux comptes de démonstration : trois chargés de compte sous un Responsable commercial (portées « propres objets » et « équipe » testables) ; la Finance existait déjà | ☐ | |
| 5 | Rejouable | Si le jeu est déjà chargé, la commande ne fait rien ; elle est intégrée à `node scripts/local-stack.mjs --demo` (elle remplace les 40 « Démo Entreprise » génériques) et se lance seule : `node apps/crm-api/dist/src/cli/seed-demo.js` | ☐ | |
| 6 | Garde-fous | Refuse la **production** et toute **base qui n'est pas locale** (hôte autre que `localhost`, `127.0.0.1`, `::1`) ; refuse sans les comptes de démonstration, avec un message qui dit quoi lancer | ☐ | |
| 7 | Données sans risque | Adresses e-mail en `.test` (domaine réservé, jamais joignable) ; numéros de téléphone du **motif fictif** (`+indicatif préfixe 00 nnnn`) et **valides selon la nouvelle règle** ; aucune vraie marque ni personne | ☐ | |

## Preuves automatisées relevées à la validation
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (238 modules) |
| Tests unitaires de l'API | **906 réussis**, 1 ignoré ; dont 15 nouveaux sur le plan et les garde-fous : déterminisme, quarante entreprises aux noms uniques et tous secteurs, chronologie sans événement dans le futur, douze mois, **numéros valides et du motif fictif**, e-mails en `.test`, ordre des dépendances, couverture de tous les états, répartition entre les trois chargés de compte et réserve des actions (dérogation, gain : Responsable commercial ; constat du paiement : Finance), règles du métier (un agrément honoré a d'abord été reçu ; une opportunité gagnée a franchi l'accord de principe), aucune marque réelle … |
| **Tests d'intégration (PostgreSQL jetable)** | **358 / 358** (25 suites) ; 5 nouveaux de bout en bout : chargement du plan entier **sans erreur** par les cas d'usage, **second chargement sans effet**, horloge rendue à la normale, répartition entre les trois chargés de compte et sur douze mois, **couverture de chaque état en base** (entreprise : cible, contactée, qualifiée, cliente ; offre : six états ; relance : faite, en retard, à venir ; rendez-vous : tenu, annulé, à venir ; opportunité : cinq étapes, ouverte, gagnée, perdue ; agrément : demandé ou reçu, honoré, expiré, annulé, avec payeur tiers ; ambassadeur : client, apprenant), … |
| **Commandes réelles de bout en bout** | Sur une base jetable : création des comptes (11), `seed-demo` (**559 événements**), second lancement (**sans effet**), refus d'une base distante, refus en production : tous conformes. Résultat en base : entreprises 4 cibles, 4 contactées, 22 qualifiées, 10 clientes ; opportunités à 6 étapes ou états ; agréments demandé, reçu, honoré, expiré ; 611 traces d'audit |

## Réserves, limites et dette connues
- Une commission en pourcentage ne porte pas de devise : le plan envoyait une devise (refusé par le domaine) ; corrigé dans le chargeur.
- Un agrément ne peut être annulé que par le Responsable commercial (le chargé de compte n'a pas ce droit) : l'événement du plan est attribué au bon rôle.
- La première couverture ne contenait ni offre « déposée sans décharge », ni opportunité à « Qualification » ou à « Agrément », ni agrément annulé, ni rendez-vous annulé : scénarios ajoutés, et la couverture est maintenant vérifiée par un test à chaque modification.
- **Seul le module commercial est couvert.** Investudy, la finance et le reporting **n'ont pas de données**, car ces modules n'existent pas encore (D133) ; créer leurs tables en avance aurait été un changement d'architecture. Leur jeu est spécifié dans le document d'observations.
- **Les écrans ne sont pas parcourus un à un dans le navigateur avec ces données** (D136) : les chiffres et les états sont vérifiés en base, pas à l'œil. À vous de parcourir les écrans après `local-stack --demo`.
- **Pas d'entreprise archivée, pas de report de rendez-vous, pas de réattribution ni de modification d'ambassadeur** dans le jeu (D134).
- **La base jetable des tests automatiques garde ses 25 entreprises génériques** (D135) ; le jeu est chargé par un test dédié.
- **Pas de mutants sur ce lot** : le plan est lui-même validé par des tests de couverture et de cohérence qui échouent si un état, une règle ou un rôle disparaît.
- Les dates du jeu sont **relatives au jour du chargement** : relancer sur une base vide un autre jour décale tout le jeu (les retards et les échéances restent parlants).
- Testé sous Node 26.7, pas rejoué sous Node 22.
- **D133 à D136** (`docs/TECH-DEBT.md`).
- **À confirmer** : noms d'entreprises et de personnes entièrement fictifs (dépôt public) ; seed par les cas d'usage ; volumes (40 entreprises, 559 événements) ; comptes de démonstration portés à 11 (un troisième chargé de compte).
- La branche porte aussi, par fusion, l'analyse `docs/cadrages/OBSERVATIONS-VALIDATION-UX-ET-DONNEES-DE-TEST.md`, jamais fusionnée dans `main` jusqu'ici.

## Rejouer les contrôles automatisés
```bash
pnpm ci                                   # types, architecture, tests unitaires et interface
node apps/crm-api/scripts/test-db.mjs     # tests d'intégration (base PostgreSQL jetable)
```

*Pas de script de mutants versionné pour ce lot.*

## Écarts constatés
| Date | Vérification n° | Description | Défaut ouvert (D…) |
|---|---|---|---|
| | | | |
