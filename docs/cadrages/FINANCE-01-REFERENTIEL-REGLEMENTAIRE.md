# Finance — 01. Référentiel réglementaire (version 0)

*2026-11-26 · Base de travail à faire valider par un expert-comptable et un juriste. Ce document ne certifie aucune conformité.*

## 0. Niveaux de preuve
| Marque | Sens |
|---|---|
| **[V]** | Lu dans le texte officiel le 2026-11-26 (extraction locale du PDF) |
| **[S]** | Source secondaire (résumé de recherche), texte officiel non lu |
| **[A]** | Connaissance métier non vérifiée sur source : à confirmer |

## 1. Question préalable : quel est le statut d'Investally ?
Les obligations COSUMAF dépendent d'un **agrément**. Le nom « Investally » **ne figure pas** dans le Règlement général ni dans la publication COSUMAF « L'Essentiel » du 1er semestre 2025, qui liste des intermédiaires [V]. Cela ne prouve pas l'absence d'agrément (autre dénomination, agrément postérieur, liste partiellement extraite).

| Hypothèse | Effet sur Finance |
|---|---|
| Société non agréée | OHADA, fiscalité, changes, LCB/FT selon l'activité. Les exigences COSUMAF des intermédiaires ne s'appliquent pas |
| Conseiller en investissements financiers (art. 312) [V] | Agrément propre ; **interdiction de recevoir des fonds ou instruments des clients** (art. 313) [V] |
| Intermédiaire de marché (société de bourse, etc.) | Capital, fonds propres, contrôle interne, enregistrements, reporting : voir section 4 |

## 2. OHADA — AUDCIF du 26 janvier 2017 et SYSCOHADA révisé
Texte numérisé de qualité moyenne : relire les articles cités sur un exemplaire propre.

| Article | Exigence (résumé) | Règle métier | Donnée et contrôle | Piste d'audit |
|---|---|---|---|---|
| 7 [V] | Exercice de douze mois, coïncidant avec l'année civile, sauf cas de début ou de cessation | Exercices et périodes par entité | `fiscal_year`, contrôle de non-chevauchement | Ouverture et clôture datées |
| 8 [V] | Bilan, compte de résultat, tableau des flux de trésorerie, notes annexes. **IFRS en sus** pour les entités cotées ou faisant appel public à l'épargne | Liasse par entité ; second référentiel si APE | Modèles d'états versionnés | Version de modèle jointe à chaque état |
| 13 [V] | Système minimal de trésorerie sous 60 M (négoce), 40 M (artisanat), 30 M FCFA (services) de chiffre d'affaires ; sinon système normal | Régime comptable paramétré par entité | `legal_entity.regime` | Changement de régime tracé |
| 15, 16 [V] | Enregistrement exhaustif et sans retard ; récapitulation par période n'excédant pas un mois ; manuel des procédures | Manuel versionné dans la gestion documentaire | Centralisation mensuelle | Historique du manuel |
| 17 [V] | Langue officielle et monnaie légale de l'État ; partie double ; pièces datées et référencées ; chronologie ; plan de comptes normalisé | Livres en monnaie légale par entité ; écriture refusée si déséquilibrée ou sans pièce | Contrainte débit = crédit en base | Référence de pièce obligatoire |
| 18 [V] | Classes de comptes ; subdivisions permises | Plan SYSCOHADA livré, extensible | `chart_account` hiérarchique | Création et désactivation tracées |
| 19 [V] | Livre-journal, grand-livre, balance générale, livre d'inventaire ; journaux auxiliaires centralisés au moins chaque mois | Livres produits par requête, figés à la clôture | Empreinte des états figés | Qui a édité, quand |
| 20 [V] | Ni blanc ni altération ; erreur de l'exercice corrigée par **inscription en négatif** puis écriture exacte | Aucune modification ni suppression d'une écriture validée | `reverses_entry_id`, droits SQL sans `UPDATE`/`DELETE` | Lien correction → origine |
| 22 [V] | Informatique : origine et imputation conservées, restitution lisible, **irréversibilité par validation**, aucune insertion intercalaire, **clôture informatique au moins trimestrielle**, états numérotés et datés, chemin de révision reconstituable | Brouillon → validé (numéroté) → période close | Séquence sans trou par journal ; verrou de période | Journal en ajout seul |
| 23 [V] | États arrêtés au plus tard quatre mois après la clôture | Calendrier de clôture avec alertes | Échéance par entité | Date d'arrêté mentionnée |
| 24 [V] | Livres et pièces conservés **dix ans** | Archivage et gel de suppression | `retention_until` | Journal des consultations [A] |
| 36, 37 [V] | Coût historique (acquisition ou production) | Fiche immobilisation avec composantes du coût | Rapprochement avec l'écriture | Pièces liées |
| 74 à 77 [V] | Comptes consolidés pour toute entité contrôlante (exclusif ou conjoint), avec exemptions ; IFRS pour les cotées ou APE | Périmètre et méthodes datés | `consolidation_scope` | Retraitements justifiés |

Non analysés dans cette version : évaluation, amortissements, provisions, conversion des devises, sanctions, détail du plan de comptes et des états du SYSCOHADA.

## 3. CEMAC — changes et lutte contre le blanchiment
| Texte | Contenu connu | Impact Finance | Preuve |
|---|---|---|---|
| Règlement n°02/18/CEMAC/UMAC/CM du 21 décembre 2018 (changes) | Opérations de change, comptes des résidents et non-résidents, transactions courantes et financières, investissements, sanctions | Attribut résident ou non-résident des comptes et tiers ; autorisation et justificatifs par opération en devises ; contrôle avant paiement | [S] ; domiciliation et rapatriement **non lus**, instructions BEAC à vérifier |
| Règlement n°02/24/CEMAC/UMAC/CM du 20 décembre 2024 (blanchiment, financement du terrorisme et de la prolifération) | Remplace le texte de 2016 ; vigilance, déclaration de soupçon, sanctions ; sanctions ciblées par le règlement n°04/24 | Dossier tiers, filtrage, alertes, déclaration | [S] ; obligations détaillées et durées **non lues** |
| Règlement COBAC R-2023/01 | Diligences des établissements assujettis bancaires | Seulement si Investally ou une filiale relève de la COBAC | [S] |

## 4. COSUMAF — Règlement général du 23 mai 2023
S'appuie sur le Règlement n°01/22/CEMAC/UMAC/CM/COSUMAF du 21 juillet 2022 [V]. **Applicable selon le statut (section 1).**

| Article | Exigence (résumé) | Composant et contrôle |
|---|---|---|
| 5 [V] | Approche par les risques ; cartographie adressée avec le rapport de contrôle interne au plus tard le 31 mars | Registre des risques, échéancier |
| 105 [V] | Conservation **dix ans** des dossiers de relation (après sa fin) et des opérations (après exécution) | Politique de conservation par type d'objet |
| 265, 266 [V] | Capital libéré d'au moins 300 M FCFA pour les services listés, 1 Md pour certaines activités des sociétés de bourse ; fonds propres jamais inférieurs au capital | Indicateur prudentiel et alerte |
| 270 [V] | Concours aux dirigeants, actionnaires et personnel plafonnés à 20 % des fonds propres, avec sûretés | Contrôle bloquant sur les avances |
| 276, 277 [V] | Continuité d'activité ; procédures comptables fournissant rapidement une image fidèle à la COSUMAF | Plan de reprise testé ; extraction à la demande |
| 287 à 290 [V] | Responsable de la conformité et du contrôle interne indépendant ; rapport annuel transmis dans les trois mois suivant la clôture | Rôle dédié, workflow du rapport |
| 291 [V] | Enregistrement des communications liées aux transactions, dix ans, inaltérable | **Hors périmètre Finance** : à attribuer |
| 313 [V] | Un conseiller en investissements ne reçoit ni fonds ni instruments | Blocage des comptes de fonds clients |
| 327 [V] | Teneur de compte : avoirs clients distingués des avoirs propres, ségrégation par client, rapprochements réguliers | Comptabilité titres séparée : **autre produit** que la comptabilité générale |

Instructions 2025 repérées dans « L'Essentiel » [V] mais **non lues** : contenu des rapports de contrôle interne (n°39-25, 40-25), fréquence et formats des reportings (n°41-25), agrément des conseillers (n°42-25). L'attribution exacte de chaque numéro est à confirmer sur le texte de chaque instruction.

## 5. Fiscalité (point de départ : Cameroun)
| Point | Valeur rapportée | Preuve |
|---|---|---|
| TVA | 19,25 % | [S] |
| Retenues TVA et acompte d'impôt sur le revenu | Arrêté n°000001/MINFI/DGI du 5 janvier 2026 listant les entités chargées de retenir ; taux d'acompte variables selon le contribuable | [S] |
| Attestations de retenue | Générées par le système de la DGI, sinon non déductibles | [S] |
| Déclaration mensuelle de TVA | Avant le 15 du mois suivant | [S], non confirmé sur texte |
| Facturation électronique et transmission | Évoquées, avec la loi de finances 2026 | [S], **à qualifier en priorité** |

**Règle de conception :** aucun taux, seuil ou échéance en dur. Chaque règle porte une juridiction, une date d'effet, une date de fin, une source et un valideur.

## 6. À obtenir avant de coder
1. Statut réglementaire d'Investally et d'Investudy, formes juridiques, liens de capital.
2. Exemplaires propres de l'AUDCIF, du plan de comptes et des modèles d'états SYSCOHADA.
3. Règlements de changes et de blanchiment, instructions BEAC et COSUMAF applicables.
4. Code général des impôts et loi de finances en vigueur.
5. Expert-comptable ou juriste désigné pour valider ce référentiel.

## Sources
- [AUDCIF, Journal officiel OHADA du 15 février 2017](https://www.oneccabf.org/wp-content/uploads/0.611.01.17-Acte-uniforme-du-26-janvier-2017_Droit-comptable.pdf)
- [Règlement général COSUMAF](https://cosumaf.org/files/documents/01KGCA9RV96SXYAY9EAHG1YBN1.pdf)
- [COSUMAF, L'Essentiel, 1er semestre 2025](https://cosumaf.org/files/documents/01KHB49GPTWCGXGH2A7SRXPSDQ.pdf)
- [Règlement des changes CEMAC 02/18](https://www.droit-afrique.com/uploads/CEMAC-Reglement-2018-02-changes.pdf)
- [Règlement CEMAC 02/24, fiche](https://app.maathis.com/droit/cemac/reglement/02-24-cemac-umac-cm-reglement-n0224cemacumaccm-portant-prevention-repression-bla)
- [Arrêté retenue à la source 2026](https://www.impots.cm/sites/default/files/documents/arr%C3%AAt%C3%A9%20RTS%202026%20VF.pdf)
- [Guide fiscal Cameroun 2026 (tiers)](https://lefisk.cm/blog/fiscalite-entreprises-cameroun-guide-complet)
