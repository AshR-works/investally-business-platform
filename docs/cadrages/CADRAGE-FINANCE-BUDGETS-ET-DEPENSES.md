# Cadrage — Finance, première tranche : budgets et dépenses

*2026-11-26 · Suite de D80 et de l'[ADR-0019](../adr/0019-finance-solution-propre.md). **Aucun code** tant que l'[emplacement](ARBITRAGE-FINANCE-EMPLACEMENT-PREMIERE-TRANCHE.md) n'est pas choisi. Les règles ci-dessous sont des **valeurs par défaut proposées**, validées ni par le responsable des affaires financières ni par le RCCI.*

## 1. But et mesure du succès
Maîtriser les dépenses : savoir qui engage quoi, sur quel budget, avec quelle pièce.

| Indicateur proposé | Avant (à relever maintenant) | Cible à fixer |
|---|---|---|
| Part des dépenses approuvées avant l'achat | | |
| Délai moyen entre la demande et la décision | | |
| Factures retrouvées avec leur demande et leur réception | | |
| Dépassements de budget détectés avant engagement | | |

Sans relevé « avant », aucun progrès ne pourra être montré.

## 2. Périmètre
| Dans la tranche | Hors de la tranche |
|---|---|
| Budgets annuels, par service et par catégorie | Grand livre, journaux, états financiers |
| Demande d'achat, approbation, bon de commande, réception | Calcul et déclaration des taxes |
| Facture fournisseur rapprochée ; dépense engagée et réalisée | Paie, notes de frais et avances nominatives |
| Constat du paiement avec justificatif | Exécution ou génération de virements |
| Export pour la comptabilité | Immobilisations, devises multiples, consolidation |

## 3. Circuit
```
Demande (brouillon) -> soumise -> approuvée | refusée
   -> bon de commande -> réception (totale ou partielle)
   -> facture rapprochée -> bonne à payer -> payée (justificatif)
Annulation possible avant réception, avec motif.
```
| Étape | Effet budgétaire |
|---|---|
| Demande soumise | Montant **réservé**, montré au valideur |
| Bon de commande | Montant **engagé** |
| Facture rapprochée | Montant **réalisé**, l'engagement diminue d'autant |
| Refus ou annulation | Réservation ou engagement libéré |

## 4. Règles par défaut
| N° | Règle proposée | À confirmer par |
|---|---|---|
| F-B1 | Un budget par exercice (année civile), service et catégorie, en XAF | Responsable financier |
| F-B2 | Un budget publié ne se modifie pas : une **révision** datée et motivée s'ajoute | Responsable financier |
| F-B3 | Dépassement : alerte et approbation de niveau supérieur, sans blocage absolu | DG |
| F-B4 | Seuils d'approbation paramétrables ; **aucune valeur proposée** | DG, responsable financier |
| F-B5 | Nul n'approuve sa propre demande | RCCI |
| F-B6 | La réception est faite par une autre personne que le valideur | RCCI |
| F-B7 | Écart entre facture et commande : bloquant au-delà d'une tolérance, nulle par défaut | Responsable financier |
| F-B8 | Un même couple fournisseur et numéro de facture ne peut être saisi deux fois | Responsable financier |
| F-B9 | Rien n'est supprimé : annulation motivée, journal d'audit | RCCI |
| F-B10 | Pièces conservées dix ans (AUDCIF art. 24 pour les pièces comptables) | Responsable financier |
| F-B11 | En cas d'absence d'un valideur : délégation datée | DG |

## 5. Rôles
| Action | Demandeur | Responsable de service | Responsable financier | DG | RCCI |
|---|---|---|---|---|---|
| Créer une demande | Oui | Oui | Oui | Oui | Non |
| Approuver | Non | Sous le seuil | Sous le seuil | Au-delà | Non |
| Préparer et publier un budget | Non | Propose | Prépare | Publie | Non |
| Bon de commande, facture, constat du paiement | Non | Non | Oui | Non | Non |
| Consulter | Ses demandes | Son service | Tout | Tout | Tout, sans écrire |

**Point de fragilité :** une seule personne tient la finance. Commander, saisir la facture et constater le paiement lui reviennent. Contrôle compensatoire proposé : une revue mensuelle des paiements par le DG ou le RCCI.

## 6. Données (esquisse)
`budget`, `budget_line`, `budget_revision`, `supplier`, `purchase_request`, `approval`, `purchase_order`, `receipt`, `supplier_invoice`, `payment_record`. Montants en décimaux exacts. Références vers les services et les personnes par identifiant, sans clé étrangère entre schémas (D161). Pièces dans le module documents ; actions dans le journal d'audit.

## 7. Lots
| Lot | Contenu | Critère de fin |
|---|---|---|
| B1 | Fournisseurs, catégories, budgets et révisions | Un budget publié puis révisé, sans écrasement |
| B2 | Demandes et approbations à seuils | Auto-approbation impossible, testée |
| B3 | Bons de commande et réceptions | Engagé exact après annulation et réception partielle |
| B4 | Factures, rapprochement, constat du paiement | Doublon refusé ; réalisé égal aux factures |
| B5 | Suivi budgétaire et export | Totaux concordants sur un mois réel |

## 8. Questions au responsable financier et au RCCI
1. Comment une dépense est-elle décidée et payée aujourd'hui, de bout en bout ?
2. Quels services et quelles catégories de budget utilisez-vous ?
3. Quels seuils, et qui approuve à chaque niveau ?
4. Quelles dépenses échappent au circuit (urgences, petite caisse, abonnements) ?
5. Que doit contenir l'export pour la comptabilité, et pour quel outil actuel ?
6. Qui contrôle ce qu'une même personne commande, enregistre et paie ?
7. Que faut-il reprendre de l'exercice en cours ?
