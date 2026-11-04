# DDR-0027 — Commissions des facilitateurs à verser : naissance à l'honneur de l'agrément, déblocage par la Finance, versement avec justificatif

| | |
|---|---|
| **Statut** | Acceptée (réalisée dans l'application) ; prototype à mettre à jour |
| **Date** | 2026-11-10 |
| **Version du design** | 0.4.1 (le prototype n'est pas encore à jour : version 0.5.0 à décider) |
| **Lié à** | Lot S4.4c ; wireframe 25 ; flux F3 (CU-F3-03 à CU-F3-05) ; décisions D41 (FD-1 B, FD-2 A, FD-2.1 c, FD-2.2 a, FD-2.3 aucun) et D44 (valeurs par défaut) ; DDR-0026 (agrément « honoré » par la Finance) |

## Contexte
Un facilitateur qui apporte une entreprise touche une **commission** (montant fixe ou pourcentage, définie par le Responsable commercial sur la fiche de l'entreprise). Les décisions D41 fixent le flux : la commission devient due quand l'agrément est **honoré**, le **DAF seul** débloque les fonds, le chargé de compte verse avec un **justificatif** (reçu de virement ou ordre de versement), et le montant dû est **figé**. Ce lot construit le suivi de ces versements dans le CRM ; le paiement lui-même reste hors du CRM (décision D5).

## Décisions
1. **Naissance** : le constat du paiement d'un agrément (« honorer », par la Finance) crée, **dans la même transaction**, un versement « à verser » si l'entreprise a un facilitateur avec commission. Un seul versement par agrément. Sans facilitateur commissionné, rien n'est dû. La page « Commissions » (module du hub) liste les versements dans la portée de l'utilisateur.
2. **Montant figé** : la définition de la commission (type, valeur, devise) est copiée dans le versement au moment où il naît ; une modification ultérieure de la fiche ne le touche pas. Un montant fixe est repris tel quel ; un **pourcentage s'applique au montant de l'agrément** (calcul en entiers, arrondi au centime le plus proche). Un pourcentage sur un agrément **sans montant** (places seules) laisse le montant « **à fixer** » : le Responsable commercial le renseigne **une seule fois**, et le déblocage est refusé tant qu'il manque.
3. **États** : à verser → **en attente** (motif obligatoire, réversible) → **fonds débloqués** → **versée** (définitif) ; **annulée** (motif obligatoire) possible tant que la commission n'est pas versée. Corriger un montant = annuler avec un motif (D41, FD-2.2 a).
4. **Qui fait quoi** : **débloquer ou mettre en attente : la Finance (le DAF) seule**, sans seuil ni seconde validation (FD-2 A) ; **verser : le chargé de compte** (Propre) et, pour son équipe, le Responsable commercial ; **annuler et fixer un montant manquant : le Responsable commercial** ; la Direction lit sans écrire. Deux permissions nouvelles : `bd.commission.release` (Finance) et `bd.commission.pay` (chargé de compte, Responsable commercial) ; l'existante `bd.commission.manage` sert à annuler et à fixer le montant.
5. **Justificatif** : un document de catégorie « Justificatif » (reçu de virement ou ordre de versement) rattaché au versement via le module Documents (nouveau type d'objet « commission », visible dans la portée du versement). Constater le versement exige **ce justificatif**, des **fonds débloqués** et une **date réelle, jamais future**. Le module Documents expose une question simple, « cet objet a-t-il un document de cette catégorie ? », sans exposer son stockage.
6. **Visibilité** : celle de l'entreprise (chargé de compte : les siennes ; Responsable commercial : son équipe ; Finance et Direction : toutes). Hors portée : « introuvable », jamais « interdit ».
7. **Audit** : la naissance et chaque changement d'état sont tracés (ancienne et nouvelle valeur, session), dans la transaction du changement.

## Mesures de rigueur
- La base garantit : version positive ; définition figée cohérente (pourcentage sans devise et au plus 100, montant fixe avec devise) ; montant positif et **obligatoire dès que les fonds sont débloqués ou versés** ; motif d'attente exactement quand elle est en attente, motif d'annulation exactement quand elle est annulée, date de versement exactement quand elle est versée ; **un seul versement par agrément** (clé unique).
- Les règles (calcul, états, droits, portée, justificatif, versions, entreprise archivée) sont couvertes par des tests unitaires, d'intégration et d'interface ; 28 fautes injectées sont toutes détectées (voir la recette). La règle de saisie du montant et de la date est comparée entre l'interface et le **domaine réel** du serveur.
- Le contrat anti-IDOR couvre les **sept routes « objet »** (liste, lecture, débloquer, attente, verser, annuler, fixer le montant) ; le refus d'une règle métier (422) sert de preuve de portée franchie quand l'action légitime n'est pas possible dans l'état de départ du test.

## Conséquences
- Réversible : une migration (une table, un type), un cas d'usage de naissance, un cas d'usage de changement d'état, une page.
- **Dette** : D137 à D141 (`docs/TECH-DEBT.md`) : aucune notification, pas de clôture ni de lecture du justificatif par le DAF, pas de page d'ensemble par facilitateur, pas de conversion de devise.
- Le droit « honorer » reste à la Finance (DDR-0026) : c'est elle qui, en constatant le paiement, **fait naître** les commissions.
- Le prototype et le wireframe 25 ne montrent pas encore la page « Commissions » ni ses fenêtres (D49).
