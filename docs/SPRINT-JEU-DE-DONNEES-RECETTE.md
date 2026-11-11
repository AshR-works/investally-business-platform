# Jeu de données de démonstration (module commercial) : recette

*Branche `sprint/jeu-de-donnees-demo` (partie de la branche S4.4a-bis : le jeu emploie l'agrément « demandé » et le payeur tiers) · 2026-11-03 · tâches T4.1 à T4.4 de `docs/cadrages/OBSERVATIONS-VALIDATION-UX-ET-DONNEES-DE-TEST.md`. Aucun changement d'architecture, de droits ni de modèle de données ; aucun document, contrat, attestation, facture, fichier joint ni certificat n'est généré.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Quarante entreprises fictives** | Banques, microfinance, fintechs, assurances, sociétés de gestion de patrimoine, sociétés de bourse, télécoms, industries, énergie, PME et grandes entreprises ; Cameroun, Côte d'Ivoire, Sénégal, Gabon, RDC ; noms **inventés** (aucune marque réelle) ; créées **sur douze mois** (de novembre 2025 à octobre 2026) |
| **Vie commerciale complète** | **617 événements** en dix scénarios en rotation (de l'entreprise « cible » seule à la cliente avec ambassadeur) : 96 contacts (dont des **doublons probables** et des contacts « autres »), 68 changements de statut, 65 rendez-vous (tenus, annulés, **reportés**, **12 à venir**), 36 offres (brouillon, déposées, décharge reçue, acceptées, refusées, retirées), 32 décharges (dont 4 **annulées puis ressaisies**), 24 relances (faites, **annulées**, **en retard**, **à venir**, jusqu'à trois par offre), 24 opportunités (de « Qualification » à « Agrément » ; perdues, gagnées, dérogations), 11 agréments (demandé, reçu, honoré, expiré, annulé ; **payeur tiers** de trois types), 5 ambassadeurs (clients et apprenants, **3 complétés** par le Responsable commercial), 3 entreprises **réattribuées** à un autre chargé de compte, 5 facilitateurs et leurs commissions |
| **Passe par les vrais cas d'usage** | Mêmes règles que l'interface (validation, états, versions, portée, audit) ; l'horloge est avancée de date en date : chaque objet a **sa vraie date de création** ; chaque action est faite **par le bon rôle** (chargé de compte propriétaire, Responsable commercial pour les dérogations, les gains et les annulations d'agrément, Finance pour constater le paiement) |
| **Équipe** | Un troisième chargé de compte (`compte3@`) s'ajoute aux comptes de démonstration : trois chargés de compte sous un Responsable commercial (portées « propres objets » et « équipe » testables) ; la Finance existait déjà |
| **Rejouable** | Si le jeu est déjà chargé, la commande ne fait rien ; elle est intégrée à `node scripts/local-stack.mjs --demo` (elle remplace les 40 « Démo Entreprise » génériques) et se lance seule : `node apps/api/dist/src/cli/seed-demo.js` |
| **Garde-fous** | Refuse la **production** et toute **base qui n'est pas locale** (hôte autre que `localhost`, `127.0.0.1`, `::1`) ; refuse sans les comptes de démonstration, avec un message qui dit quoi lancer |
| **Données sans risque** | Adresses e-mail en `.test` (domaine réservé, jamais joignable) ; numéros de téléphone du **motif fictif** (`+indicatif préfixe 00 nnnn`) et **valides selon la nouvelle règle** ; aucune vraie marque ni personne |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`), architecture (`pnpm arch`) | 0 erreur · aucune violation (238 modules) |
| Tests unitaires de l'API | **906 réussis**, 1 ignoré ; dont 15 nouveaux sur le plan et les garde-fous : déterminisme, quarante entreprises aux noms uniques et tous secteurs, chronologie sans événement dans le futur, douze mois, **numéros valides et du motif fictif**, e-mails en `.test`, ordre des dépendances, couverture de tous les états, répartition entre les trois chargés de compte et réserve des actions (dérogation, gain : Responsable commercial ; constat du paiement : Finance), règles du métier (un agrément honoré a d'abord été reçu ; une opportunité gagnée a franchi l'accord de principe), aucune marque réelle connue, refus de la production et d'une base distante |
| **Tests d'intégration (PostgreSQL jetable)** | **358 / 358** (25 suites) ; 5 nouveaux de bout en bout : chargement du plan entier **sans erreur** par les cas d'usage, **second chargement sans effet**, horloge rendue à la normale, répartition entre les trois chargés de compte et sur douze mois, **couverture de chaque état en base** (entreprise : cible, contactée, qualifiée, cliente ; offre : six états ; relance : faite, en retard, à venir ; rendez-vous : tenu, annulé, à venir ; opportunité : cinq étapes, ouverte, gagnée, perdue ; agrément : demandé ou reçu, honoré, expiré, annulé, avec payeur tiers ; ambassadeur : client, apprenant), numéros conformes à la règle, journal d'audit rempli ; le jeu est retiré en fin de test, car la base est partagée avec les autres suites (une première version faussait la liste des contacts : corrigé) |
| **Commandes réelles de bout en bout** | Sur une base jetable : création des comptes (11), `seed-demo` (**617 événements**), second lancement (**sans effet**), refus d'une base distante, refus en production : tous conformes. Résultat en base : entreprises 4 cibles, 4 contactées, 22 qualifiées, 10 clientes ; opportunités à 6 étapes ou états ; agréments demandé, reçu, honoré, expiré ; 676 traces d'audit |

## Enrichissement du 2026-11-04 (retours de la direction produit)
Le jeu a été enrichi sur les points faibles signalés : **plus d'agenda à venir** (12 rendez-vous à venir de trois types, dont des reports), **relances** multipliées (24, jusqu'à trois par offre, dont des annulées et des relances en retard), **contacts** : doublons probables et davantage de contacts « autres », **décharges annulées puis ressaisies**, **réattribution** de trois entreprises par le Responsable commercial, **ambassadeurs modifiés** par le Responsable commercial. Les tests de couverture (plan et base) vérifient chacun de ces points ; une entreprise réattribuée n'a plus d'événement de son ancien chargé de compte après la réattribution (vérifié par un test). Intégration : **358 / 358** (25 suites), unitaires de l'API : **908**.

## Défauts trouvés par la recette et corrigés
- Une commission en pourcentage ne porte pas de devise : le plan envoyait une devise (refusé par le domaine) ; corrigé dans le chargeur.
- Un agrément ne peut être annulé que par le Responsable commercial (le chargé de compte n'a pas ce droit) : l'événement du plan est attribué au bon rôle.
- La première couverture ne contenait ni offre « déposée sans décharge », ni opportunité à « Qualification » ou à « Agrément », ni agrément annulé, ni rendez-vous annulé : scénarios ajoutés, et la couverture est maintenant vérifiée par un test à chaque modification.

## Réserves sur la recette
- **Seul le module commercial est couvert.** Investudy, la finance et le reporting **n'ont pas de données**, car ces modules n'existent pas encore (D133) ; créer leurs tables en avance aurait été un changement d'architecture. Leur jeu est spécifié dans le document d'observations.
- **Les écrans ne sont pas parcourus un à un dans le navigateur avec ces données** (D136) : les chiffres et les états sont vérifiés en base, pas à l'œil. À vous de parcourir les écrans après `local-stack --demo`.
- **Pas d'entreprise archivée** (aucun cas d'usage d'archivage n'existe encore), **pas de modification d'un contact ni de retrait d'une offre après acceptation** dans le jeu (D134).
- **La base jetable des tests automatiques garde ses 25 entreprises génériques** (D135) ; le jeu est chargé par un test dédié.
- **Pas de mutants sur ce lot** : le plan est lui-même validé par des tests de couverture et de cohérence qui échouent si un état, une règle ou un rôle disparaît.
- Les dates du jeu sont **relatives au jour du chargement** : relancer sur une base vide un autre jour décale tout le jeu (les retards et les échéances restent parlants).
- Testé sous Node 26.7, pas rejoué sous Node 22.

## Dette et à confirmer
- **D133 à D136** (`docs/TECH-DEBT.md`).
- **À confirmer** : noms d'entreprises et de personnes entièrement fictifs (dépôt public) ; seed par les cas d'usage ; volumes (40 entreprises, 617 événements) ; comptes de démonstration portés à 11 (un troisième chargé de compte).
- La branche porte aussi, par fusion, l'analyse `docs/cadrages/OBSERVATIONS-VALIDATION-UX-ET-DONNEES-DE-TEST.md`, jamais fusionnée dans `main` jusqu'ici.

## À valider
1. Le jeu en situation : `node scripts/local-stack.mjs --demo`, puis parcourir chaque écran avec les comptes de démonstration.
2. « Je valide Jeu de données » → fusion avec commit de fusion et étiquette `jeu-de-donnees-validated` ; cette PR dépend de la PR 40 (S4.4a-bis) : à fusionner après elle.
