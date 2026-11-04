# S4.4c — commissions des facilitateurs à verser : recette

*Branche `sprint/s4-4c-commissions` (partie de `main`, après le jeu de données enrichi) · 2026-11-10 · flux F3 (CU-F3-03 à CU-F3-05) ; DDR-0027 ; décisions D41 (FD-1 B, FD-2 A, FD-2.1 c, FD-2.2 a, FD-2.3 aucun) et D44. Troisième et dernière partie de la session S4.4.*

## Ce qui est livré
| Demande | Réponse |
|---|---|
| **Page « Commissions »** | Module du hub : tableau (facilitateur, entreprise, montant à verser, commission figée, état avec motif, date de versement), filtre par état, pagination, actions de ligne selon l'état et les droits |
| **Une commission naît à l'honneur de l'agrément** | Quand la Finance constate le paiement d'un agrément, un versement « à verser » est créé **dans la même transaction**, **une seule fois par agrément**, si l'entreprise a un facilitateur avec commission ; sinon rien n'est dû |
| **Montant figé** | Montant fixe repris tel quel ; **pourcentage du montant de l'agrément**, arrondi au centime (calcul en entiers) ; la définition est copiée dans le versement : modifier la fiche ensuite ne le touche pas. Un pourcentage sur un agrément **sans montant** laisse le montant « **à fixer** » : le Responsable commercial le renseigne **une fois**, et le déblocage est refusé tant qu'il manque |
| **Déblocage par la Finance (le DAF seul)** | « Débloquer les fonds » ou « Mettre en attente » (motif obligatoire, réversible) ; pas de seconde validation ni de seuil (D41, FD-2 A) ; nouvelle permission `bd.commission.release` |
| **Versement avec justificatif** | « Constater le versement » par le chargé de compte (ou le Responsable commercial pour son équipe) : **fonds débloqués**, **justificatif déposé** (document de catégorie « Justificatif » : reçu de virement ou ordre de versement) et **date réelle non future** ; nouvelle permission `bd.commission.pay` |
| **Annulation motivée** | Le Responsable commercial annule avec un motif, **tant que la commission n'est pas versée** ; c'est le seul moyen de corriger un montant (D41, FD-2.2 a) ; fixer un montant manquant : `bd.commission.manage` |
| **Justificatif dans Documents** | Nouveau type d'objet « commission » (visible dans la portée du versement) ; le module Documents expose une question simple (« cet objet a-t-il un document de cette catégorie ? ») sans exposer son stockage |
| **Visibilité** | Celle de l'entreprise : chargé de compte les siennes, Responsable commercial son équipe, Finance et Direction toutes ; hors portée : « introuvable » |
| **Audit** | Naissance et chaque changement d'état tracés (ancienne et nouvelle valeur, session) |
| **Base de données** | Migration `20261111000000_s4_4c_commission_payouts` : table, type d'état, clé unique par agrément, 8 contraintes |
| **Jeu de démonstration** | Les entreprises du scénario « cliente » ont un facilitateur commissionné : les commissions dues, débloquées, en attente et annulées sont chargées (pas de commission « versée » : elle exige un justificatif, donc un document) |

## Preuves
| Contrôle | Résultat |
|---|---|
| Types (`tsc`, API et web), architecture (`pnpm arch`) | 0 erreur · aucune violation |
| Tests unitaires de l'API | **939 réussis**, 1 ignoré (les suites d'intégration sont ignorées dans cette passe) ; 31 nouveaux (domaine : 14 ; cas d'usage : 16 ; plan du jeu : 1) |
| **Tests d'intégration (PostgreSQL jetable)** | **375 / 375** (26 suites) ; 10 nouveaux de bout en bout (cycle complet avec justificatif, attente et annulation, pourcentage et montant à fixer, sans commission, portée et droits, justificatif visible dans la portée seulement, entreprise archivée, règles de la base, verrou optimiste au niveau de la base, audit) et 7 sondes IDOR |
| **IDOR** | Les sept routes « objet » (liste, lecture, débloquer, attente, verser, annuler, fixer le montant) sont classées et sondées : même réponse pour la commission d'un collègue et pour un identifiant inexistant, aucune écriture, aucune fuite. Quand l'action légitime n'est pas possible dans l'état de départ (verser une commission non débloquée, fixer un montant déjà chiffré), le refus métier (422) sert de preuve que la portée est franchie |
| Règles garanties par la base | Montant positif et **obligatoire dès le déblocage** ; définition figée cohérente (pourcentage sans devise, au plus 100) ; motif d'attente, d'annulation et date de versement exactement quand l'état l'exige ; version positive ; **un versement par agrément** : vérifiés par des écritures directes refusées |
| Tests de l'interface | **518 / 518** (10 nouveaux) : libellés d'état, montant et définition, matrice complète des actions selon l'état et le rôle, saisie de la date et du montant ; **cohérence avec le domaine réel du serveur** sur le montant à fixer |
| **Mutants** | **28 / 28 tués** (arrondi du pourcentage, montant fixe, déblocage sans montant ou répété, attente sans motif, versement sans justificatif ou avant déblocage ou à date future, annulation après versement, montant refixé, commission sans définition, doublon par agrément, trois droits permutés, justificatif non contrôlé ou de mauvaise catégorie, entreprise archivée, verrou optimiste, déclencheur à l'honneur, portée de la liste, route de déblocage, trois contraintes de la base, trois règles de l'interface) ; script `scripts/mutants/s44c-commissions.py`. Un « survivant » apparent (R11) était un artefact du script (la faute empêchait la compilation, ce qui compte comme détectée) : le script le reconnaît désormais |
| **Navigateur réel (Edge + axe-core)** | **Parcours ciblé** (connexion, entreprise, agréments, page Commissions) : **81 contrôles réussis, 0 violation** ; nouveau parcours : la commission née de l'agrément honoré est listée « À verser » avec son montant figé (**7,5 % de 2 500 000 = 187 500**), déblocage, fenêtre de versement, **refus du versement sans justificatif annoncé**, filtre par état. Le seul ✘ est l'arrêt volontaire de fin de parcours. Résultats `docs/accessibilite/resultats/axe-2026-11-10-s44c.json`, captures `docs/accessibilite/s44c-captures/` |

## Défauts trouvés par la recette et corrigés
- Aucun défaut de produit n'a été trouvé par les tests, les mutants ni l'audit.
- Côté outils : (1) le script de mutants classait « survivante » une faute qui empêche la compilation ; (2) un nom de fonction en double rendait le script d'audit inexécutable (détecté et corrigé avant tout résultat) ; (3) les tests de l'interface devaient écrire les espaces insécables en séquences d'échappement.

## Réserves sur la recette
- **Parcours navigateur ciblé** : les écrans des lots antérieurs ne sont pas revérifiés ; **seul le Super administrateur est parcouru** : la Finance, le chargé de compte et le Responsable commercial sont couverts par les tests d'intégration, l'IDOR, les mutants et les tests de l'interface (matrice des actions), pas par l'audit navigateur.
- **Le dépôt du justificatif et l'état « Versée » ne sont pas rejoués dans le navigateur** (le refus sans justificatif l'est) : ils sont couverts par les tests d'intégration (dépôt de document puis versement).
- **Pas de commission « versée » dans le jeu de démonstration** : elle exige un justificatif, donc un document (exclu du jeu).
- **La Finance ne lit pas les justificatifs** (aucun droit sur les documents) et **le DAF ne clôture pas** après le versement (CU-F3-05 le prévoyait) : D138, à confirmer.
- **Aucune notification** (D137) ; **pas de page par facilitateur ni d'export** (D140) ; **pas de conversion de devise** (D141).
- Pas de passage au lecteur d'écran réel ; testé sous Node 26.7, pas rejoué sous Node 22. Le prototype et le wireframe 25 ne sont pas à jour (D49).

## Dette et à confirmer
- **D137 à D141** (`docs/TECH-DEBT.md`).
- **D44 — à confirmer** : naissance à l'honneur de l'agrément, montant figé (pourcentage du montant de l'agrément ; montant « à fixer » sinon), déblocage par la Finance seule sans seuil, versement par le chargé de compte (et le Responsable commercial) avec justificatif et date réelle non future, annulation et montant manquant par le Responsable commercial, pas de clôture par le DAF, la Finance ne lit pas les justificatifs.

## À valider
1. Les écrans (liste, déblocage, versement avec justificatif, annulation, montant à fixer) et les valeurs par défaut de D44.
2. « Je valide S4.4c » → fusion avec commit de fusion et étiquette `s4-4c-validated`.
