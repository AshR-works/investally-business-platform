# S4.4a — agréments : la promesse de paiement signée : recette

*Branche `sprint/s4-4a-agrements` (partie de `main`, après S4.3c) · 2026-11-08 · cas d'usage CU-F1-05 ; flux F1 et C5 ; DDR-0024 ; décisions D1 à D5 et D39. Première partie de la session S4.4 ; S4.4b (ambassadeurs) et S4.4c (commissions à verser) ne sont pas livrés.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Panneau « Agréments »** | Sur la fiche de l'entreprise : opportunité, ce qui est couvert, date de réception, validité, état, motif de clôture ; menu d'actions par agrément |
| **Enregistrer un agrément** | Opportunité qui a franchi l'accord de principe (étape « Accord de principe » ou « Agrément », ouverte ou gagnée, jamais perdue) ; **montant, nombre de places, ou les deux** (D1) ; devise XAF par défaut ; date de réception ; **fin de validité facultative** (D3) ; **document signé joint** ; payeur = le client seulement (D2) |
| **Un seul agrément actif** | Une opportunité n'a qu'un agrément reçu ou honoré à la fois ; la base le garantit |
| **Entreprise « Cliente »** | L'enregistrement fait passer l'entreprise à « Cliente » (flux C5), tracé dans l'audit ; elle le reste si l'agrément est ensuite annulé |
| **Cycle** | Reçu → **honoré** (le paiement a eu lieu, constaté à la main : D5), ou **expiré** / **annulé** avec un **motif obligatoire** ; tous définitifs ; une validité dépassée est signalée, l'expiration reste manuelle |
| **Droits** | Lire et enregistrer : chargé de compte (Propre), Responsable commercial (Équipe), Direction (lecture) ; **honorer** et **annuler / expirer** sont deux droits distincts, tenus par le Responsable commercial |
| **Investudy** | L'événement « agrément accordé » est enregistré sur l'agrément ; aucun consommateur n'existe encore (D113) |
| **Base de données** | Migration `20261107000000_s4_4a_approvals` : table, clés étrangères, index unique de l'agrément actif et sept contrôles |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation (228 modules) |
| Tests unitaires de l'API | **833 réussis**, 0 échec (les suites d'intégration, qui exigent la base, sont ignorées dans cette passe) ; 29 nouveaux (domaine : 14 ; cas d'usage : 15), dont le cas des **droits distincts** testé avec des droits construits à la main |
| **Tests d'intégration (PostgreSQL jetable)** | **338 / 338** (23 suites) ; 10 nouveaux de bout en bout : cycle et entreprise « Cliente », motifs, refus (avant l'accord, perdue, second agrément, sans montant ni places, date future, identifiant mal écrit, champ inconnu), portée et droits, version périmée, **document signé** (visible dans la portée, refusé hors portée **et à un rôle qui lit tous les documents mais pas les agréments**), entreprise archivée, règles de la base, verrou optimiste au niveau de la base, audit |
| **IDOR** | Les six routes sont classées « objet » et sondées : même réponse pour l'agrément d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite |
| Règles garanties par la base | Un seul agrément actif par opportunité ; montant et places positifs ; au moins l'un des deux ; validité jamais avant la réception ; clôture cohérente (date et motif) ; version positive ; liens existants : vérifiés par des écritures directes refusées |
| Tests de l'interface | **433 / 433** (25 nouveaux) : saisie, devise et dates, corps de la requête, couverture, opportunités éligibles, actions selon l'état et les droits, motif ; **cohérence avec le domaine réel du serveur** sur 15 saisies |
| **Mutants** | **18 / 18 tués** (accord de principe non exigé, opportunité perdue, plusieurs agréments actifs, entreprise non passée cliente, honorer sous le droit d'annuler, verrou optimiste, validité avant la réception, ni montant ni places, motif trop court, agrément clos modifiable, portée de la liste, droit de la route d'honorer, contraintes de la base, document visible hors portée, validité dépassée le jour même, places non enregistrées, clôture incohérente) |
| **Navigateur réel (Edge + axe-core)** | **Parcours ciblé** (connexion, entreprise, opportunité menée à l'accord de principe par une dérogation, puis le bloc de ce lot) : **51 contrôles réussis, 0 violation** : panneau vide, fenêtre d'enregistrement, champs non conformes, enregistrement avec le document, liste (« Reçu », « 4 000 000 », « 12 places », entreprise « Cliente »), annulation sans motif puis avec motif. Le seul ✘ est l'arrêt volontaire de fin de parcours. Résultats `docs/accessibilite/resultats/axe-2026-11-08-s44a.json`, captures `docs/accessibilite/s44a-captures/` |

## Défauts trouvés par la recette et corrigés
- **Test manquant** : le premier passage des mutants a laissé survivre « document visible hors portée ». Le résolveur de documents des agréments n'était protégé que par la portée du module Documents ; un rôle qui lit **tous** les documents sans lire les agréments (responsable de formation) n'était pas testé. Test ajouté, mutant tué.
- **Droits de lecture oubliés** : au premier essai, le chargé de compte n'avait pas les droits sur les agréments (les tests unitaires l'ont signalé immédiatement) ; corrigés.
- **Sondes IDOR** : l'enregistrement d'un agrément fait passer l'entreprise à « cliente » et change sa version ; les agréments des sondes vivent sur une seconde entreprise pour ne pas fausser les sondes de la première.
- **Audit** (outil, hors application) : un sélecteur d'attente erroné sur la liste, corrigé ; un parcours a échoué au début (limitation de débit à la connexion) sans rapport avec ce lot et a réussi à la relance.

## Réserves sur la recette
- **Parcours navigateur ciblé** : les écrans des lots antérieurs ne sont pas revérifiés (le navigateur sans fenêtre décroche dans l'agenda, voir la recette de S4.3b). Honorer et déclarer expiré ne sont pas parcourus dans le navigateur (couverts par les tests d'intégration et les mutants) ; l'annulation, elle, l'est.
- **Capture manquante** de la colonne « Valeur » (lot précédent) ; les trois captures des agréments sont fournies.
- **Pas d'état « demandé »** (D111) ; **honorer à la main** par le Responsable commercial en attendant la finance (D112) ; **événement vers Investudy non consommé** et règle D4 sans objet tant que les inscriptions n'existent pas (D113) ; **un seul agrément actif**, non modifiable (D114) ; **l'entreprise reste cliente** après annulation (D115) ; **pas de page transverse ni de rappel d'expiration** (D116) ; **document obligatoire dans l'interface seulement**, envoi en deux temps comme les décharges (D117).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22. Le prototype et le wireframe 23 ne sont pas à jour (D49).

## Dette et à confirmer
- **D111 à D117** (`docs/TECH-DEBT.md`) ; D105 soldée.
- **D39 — à confirmer** : les valeurs de D1 à D5 (places et/ou somme, client payeur seul, expiration manuelle, paiement suivi par la finance), l'absence d'état « demandé », l'entreprise « Cliente » à l'enregistrement, le droit d'honorer tenu par le Responsable commercial.

## À valider
1. Les écrans (panneau « Agréments », fenêtre d'enregistrement, annulation avec motif, entreprise devenue « Cliente ») et les valeurs par défaut de D39.
2. « Je valide S4.4a » → fusion avec commit de fusion et étiquette `s4-4a-validated`.
