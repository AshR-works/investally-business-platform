# Finance : inventaire documentaire de la gestion comptable et fiscale

*2026-11-26 · Propositions à corriger par le responsable des affaires financières. Établi à partir de connaissances métier **non vérifiées sur les textes**, sauf mention : non exhaustif, il ne certifie aucune conformité.*

**Mode :** **C** créé dans l'application · **R** reçu puis archivé · **Réf** seulement référencé (géré ailleurs).
**Conservation :** **10** = dix ans, pièce ou livre comptable (AUDCIF art. 24) · **10 ?** = dix ans proposés, à confirmer.
**Validation proposée :** CPT comptable · RAF · DAF · DG · CONF responsable conformité · — aucune.
**Correction :** à remplir (mode, valideur, écriture, durée, ou « sans objet »).

Compléments : [documents à faire valider](FINANCE-03-DOCUMENTS-A-VALIDER.md) (règles, livres, états et obligations) et [architecture cible](FINANCE-02-ARCHITECTURE-CIBLE.md).

## 1. Ventes
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| V1 | Devis | C | RAF au-delà d'un seuil | Aucune | 10 ? | |
| V2 | Bon de commande ou accord du client | R | CPT | Aucune | 10 ? | |
| V3 | Contrat client | R | DG | Aucune ; fixe l'échéancier | 10 ? | |
| V4 | Facture | C | RAF | Créance et produit, taxes | 10 | |
| V5 | Facture d'acompte | C | RAF | Avance reçue, taxes selon la règle | 10 | |
| V6 | Avoir | C | RAF | Annulation totale ou partielle | 10 | |
| V7 | Reçu d'encaissement | C | CPT | Encaissement | 10 | |
| V8 | Relance et mise en demeure | C | RAF | Aucune ; provision possible | 10 ? | |

## 2. Achats
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| A1 | Demande d'achat | C | Responsable du service | Aucune ; engagement budgétaire | 10 ? | |
| A2 | Devis fournisseur | R | RAF | Aucune | 10 ? | |
| A3 | Bon de commande | C | RAF ou DAF selon le seuil | Aucune ; engagement | 10 ? | |
| A4 | Bon de réception ou attestation de service fait | C | Autre personne que l'acheteur | Charge à payer à la clôture | 10 | |
| A5 | Facture et avoir fournisseur | R | RAF | Dette et charge, taxes | 10 | |
| A6 | Contrat fournisseur, bail | R | DG | Charges selon l'échéancier | 10 ? | |

## 3. Paiements et trésorerie
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| T1 | Ordre de paiement ou de virement | C | Deux signataires | Aucune avant exécution | 10 | |
| T2 | Avis de débit et de crédit, preuve de paiement | R | CPT | Paiement ou encaissement | 10 | |
| T3 | Chèques émis, reçus et bordereaux de remise | C ou R | RAF | Mouvement bancaire | 10 | |
| T4 | Pièces et journal de caisse | C | RAF | Mouvement de caisse | 10 | |
| T5 | Procès-verbal de contrôle de caisse | C | DAF | Écart constaté | 10 | |
| T6 | Relevé bancaire | R | — | Aucune ; sert au rapprochement | 10 | |
| T7 | État de rapprochement | C | RAF | Ajustements justifiés | 10 | |
| T8 | Contrat d'emprunt ou de placement, échéancier | R | DG | Capital, intérêts, produits | 10 | |
| T9 | Prévision de trésorerie | C | DAF | Aucune | 10 ? | |

## 4. Personnel (montants agrégés ou nécessaires au paiement)
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| P1 | Journal de paie agrégé | R | DAF | Charges de personnel et dettes | 10 | |
| P2 | Déclarations et paiements sociaux (CNPS) | R | DAF | Dette sociale et paiement | 10 | |
| P3 | Ordre de mission | Réf | RH | Aucune | 10 ? | |
| P4 | Note de frais et justificatifs | C | Responsable puis RAF | Charge et dette envers l'employé | 10 | |
| P5 | Demande et remboursement d'avance | C | DAF | Avance, puis récupération | 10 | |
| P6 | Décompte d'indemnités | R | DAF | Charge et dette | 10 | |

Ces lignes touchent des personnes : droits restreints et avis juridique. Les bulletins et salaires individuels restent hors application (D55 à D60) ; les lignes P4 à P6 nomment un bénéficiaire et demandent **une décision explicite**.

## 5. Fiscalité
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| F1 | Déclaration mensuelle de TVA et autres taxes | C | DAF | Taxe due ou crédit | 10 | |
| F2 | État des retenues à la source opérées et subies | C | RAF | Retenues dues ou déductibles | 10 | |
| F3 | Attestation de retenue | R | CPT | Justifie la déduction | 10 | |
| F4 | Acomptes d'impôt sur les résultats | C | DAF | Acompte versé | 10 | |
| F5 | Déclaration statistique et fiscale annuelle | C | DAF puis DG | Impôt de l'exercice | 10 | |
| F6 | Patente et autres impôts locaux | R | DAF | Charge d'impôt | 10 | |
| F7 | Quittances et reçus de paiement des impôts | R | CPT | Paiement | 10 | |
| F8 | Attestation de conformité fiscale | R | RAF | Aucune ; échéance suivie | 10 ? | |
| F9 | Avis, notifications, redressements et réponses | R | DAF puis DG | Provision ou dette | 10 | |

## 6. Immobilisations et stocks
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| I1 | Facture d'acquisition (renvoi à A5) | Réf | RAF | Entrée à l'actif | 10 | |
| I2 | Procès-verbal de mise en service | C | Responsable du bien | Début d'amortissement | 10 | |
| I3 | Plan et tableau d'amortissement | C | DAF | Dotations | 10 | |
| I4 | Transfert entre services ou sociétés | C | DAF | Reclassement ou cession interne | 10 | |
| I5 | Cession ou mise au rebut | C | DG | Sortie de l'actif, résultat | 10 | |
| I6 | Bons d'entrée et de sortie de stock, s'il y en a | C | Magasinier puis RAF | Variation de stock | 10 | |
| I7 | Fiche physique de l'équipement (Assets) | Réf | — | Aucune | Selon Assets | |

## 7. Clôture et états
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| C1 | Pièce d'opérations diverses | C | RAF | Régularisation | 10 | |
| C2 | Calcul des provisions et des charges à rattacher | C | DAF | Écritures d'inventaire | 10 | |
| C3 | Livres, balances et états financiers (voir liste C) | C | DAF | Aucune ; figés à la clôture | 10 | |
| C4 | Procès-verbal d'approbation des comptes et d'affectation du résultat | R | Organe compétent | Affectation du résultat | 10 ? | |
| C5 | Rapports du commissaire aux comptes et réponses | R | DG | Ajustements éventuels | 10 ? | |

## 8. Société, devises, tiers et engagements
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| S1 | Statuts, immatriculation, identifiant fiscal | R | DG | Capital, selon l'acte | 10 ? | |
| S2 | Convention entre sociétés du groupe | R | DG | Flux intra-groupe | 10 ? | |
| S3 | Dossier d'une opération en devises (domiciliation, autorisation, justificatifs) | R | DAF et CONF | Opération et écart de change | 10 ? | |
| S4 | Dossier d'identification et de vigilance d'un tiers | C et R | CONF | Aucune ; peut bloquer un paiement | 10 après la relation, selon le statut | |
| S5 | Police d'assurance et sinistre | R | DAF | Prime, indemnité | 10 ? | |
| S6 | Caution et garantie | R | DG | Engagement à mentionner | 10 ? | |

## 9. Pilotage et contrôle
| N° | Document | Mode | Validation | Écriture déclenchée | Conservation | Correction |
|---|---|---|---|---|---|---|
| R1 | Budget et révisions | C | DAF puis DG | Aucune | 10 ? | |
| R2 | Tableau de bord et analyse des écarts | C | DAF | Aucune | 10 ? | |
| R3 | Rapport de gestion | C | DG | Aucune | 10 ? | |
| R4 | Rapports d'audit interne et plans d'action | C et R | DG | Aucune | 10 ? | |
| R5 | Rapports et cartographie dus à la COSUMAF, selon le statut | C | CONF puis DG | Aucune | 10 ? | |

## Documents manquants à ajouter
| Document | Mode | Validation | Écriture déclenchée | Conservation |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

**Relu par :** ______________________ **Fonction :** ______________________ **Date :** ______________
