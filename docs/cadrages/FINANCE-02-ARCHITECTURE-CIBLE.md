# Finance — 02. Architecture cible (version 0)

*2026-11-26 · Proposition, rien n'est décidé, aucun code. À lire après [01. Référentiel réglementaire](FINANCE-01-REFERENTIEL-REGLEMENTAIRE.md) et avec [l'arbitrage construire ou acheter](ARBITRAGE-FINANCE-CONSTRUIRE-OU-ACHETER.md), **qui conditionne ce qui suit**.*

Les descriptions de Sage et des autres ERP viennent de connaissances générales **non vérifiées sur documentation officielle**. Les durées, droits et règles marqués « à valider » ne sont pas des exigences établies.

## 0. Contradictions avec l'existant, à lever d'abord
| Sujet | Existant | Nouvelle demande | À trancher |
|---|---|---|---|
| Découpage | ADR-0005 : CRM d'un côté, ERP (Finance, RH, Fiscalité, reporting) de l'autre | Applications CRM, RH, Finance distinctes | Remplacer l'ADR-0005 par un nouvel ADR |
| Assets Management | Quatrième application demandée après la démonstration | Non citée ; Finance porte les immobilisations | Qui possède le bien ? Proposé : Assets le physique, Finance la valeur |
| Paie | D55 à D60 : salaires et paie exclus de l'application | Intégration RH : paie, avances, frais, indemnités | Proposé : Finance reçoit des écritures de paie **agrégées**, sans salaire individuel |
| Commissions | D41 : le DAF seul débloque, sans seconde validation ni seuil | Séparation des tâches | Revoir D41 ou documenter l'exception |
| Priorité | CRM prioritaire (ADR-0005) | Plateforme financière complète | Ordre à fixer avec le DG |

## 1. Cartographie fonctionnelle (livrables 2 et 16)
| Domaine | Fonctions | Priorité | Piste |
|---|---|---|---|
| Référentiels | Entités, exercices, plan comptable, journaux, axes analytiques, devises, banques, tiers, taux | P0 | Socle |
| Comptabilité générale | Saisie, validation, grand livre, balance, clôtures, états | P0 | Logiciel ou interne selon l'arbitrage |
| Auxiliaire | Clients, fournisseurs, partenaires, lettrage, balance âgée | P0 | Idem |
| Audit et conformité | Journal, versions, archivage | P0 | Transverse, dès le premier jour |
| Facturation | Devis, factures, avoirs, règlements | P1 | Reprend les offres et agréments du CRM |
| Trésorerie | Banques, caisses, rapprochements, prévisions | P1 | |
| Fiscalité | TVA, retenues, déclarations, échéancier | P1 | |
| Achats | Demande, commande, réception, rapprochement à trois | P2 | |
| Immobilisations | Actif, amortissements, transferts, sortie | P2 | Lien Assets |
| Budgets | Annuel, départemental, prévisions, engagements | P2 | |
| Contrôle de gestion | Indicateurs, écarts, rentabilité | P3 | |
| Reporting | Opérationnel, Direction, DAF, réglementaire | P1 à P3 | |
| Consolidation | Périmètre, éliminations, conversion | P3 | Dès qu'une seconde entité juridique est confirmée |

## 2. Architecture métier (livrable 3)
Contextes, chacun propriétaire de ses données :
- **Référentiel financier** : ce que tous utilisent.
- **Grand livre** : seul à écrire des écritures. Les autres lui **demandent** une comptabilisation.
- **Tiers et auxiliaires**, **Facturation**, **Achats**, **Trésorerie**, **Immobilisations** : produisent des pièces et des demandes.
- **Fiscalité** : règles datées, calcul, déclarations.
- **Pilotage** : budgets, contrôle de gestion, reporting ; lecture seule.
- **Consolidation** : lit les soldes validés, n'écrit jamais dans les livres des entités.

Chaîne type : pièce → contrôles → approbation → comptabilisation → paiement → lettrage → clôture → état → archive.

Hors périmètre tant que le statut n'est pas fixé : tenue de comptes titres, fonds de clients, valorisation d'actifs gérés. Ce sont d'autres métiers, avec d'autres obligations.

## 3. Architecture applicative (livrable 4)
```
 Identité commune ──> Finance (adresse propre, base propre)
                        |-- interface web Finance
                        |-- API Finance (monolithe modulaire, couches existantes)
                        |     referentiel | grand-livre | tiers | facturation | achats
                        |     tresorerie | immobilisations | fiscalite | pilotage | consolidation
                        |-- base PostgreSQL Finance (écritures en ajout seul)
                        |-- boîte d'envoi / réception ──> CRM, RH, Assets (liste fermée)
                        `-- archive des pièces (empreinte, conservation)
```
Réemploi : conventions NestJS, Prisma, contrôle `pnpm arch`, identité, audit. Pas de microservices. Les tâches longues (clôtures, états) passent par une file, sans nouvel outil au départ.

## 4. Architecture des données (livrable 5)
| Objet | Contenu essentiel | Invariant |
|---|---|---|
| `legal_entity` | Forme, pays, régime, devise légale, référentiel | Chaque ligne métier porte l'entité ; cloisonnement en base |
| `fiscal_year`, `period` | Dates, état | Pas d'écriture dans une période close |
| `account` | Numéro, classe, nature, lettrable | Non supprimable s'il a servi |
| `journal` | Code, type, séquence | Numérotation continue |
| `entry`, `entry_line` | Date de valeur, pièce, origine, montants, devise, taux, axes | Équilibre ; immuable après validation ; correction liée |
| `third_party` | Rôle, identifiants fiscaux, résidence, statut de vigilance | Référence l'entreprise CRM par identifiant, sans clé étrangère (D161) |
| `fx_rate` | Paire, date, source, valeur | Jamais modifié, seulement ajouté |
| `tax_rule` | Juridiction, taux, effet, source, valideur | Datée |
| `document` | Type, empreinte, conservation | Immuable après émission |
| `approval` | Demandeur, valideur, décision, motif | Valideur différent du demandeur |

Montants en décimaux exacts, jamais en virgule flottante ; règles d'arrondi par devise (XAF et XOF sans décimale [à valider]).

## 5. Architecture comptable SYSCOHADA (livrable 6)
- Plan de comptes SYSCOHADA livré comme référentiel versionné, subdivisions par entité (art. 18).
- Journaux proposés : achats, ventes, banques (un par compte), caisse, opérations diverses, paie, immobilisations, à-nouveaux.
- Cycle : **brouillon → validé** (numéro, date de validation) **→ période close → exercice clos**. Après validation : correction par inscription en négatif (art. 20).
- Clôtures : mensuelle (centralisation, art. 19), informatique au moins trimestrielle (art. 22), annuelle avec inventaire, états arrêtés sous quatre mois (art. 23).
- États : bilan, compte de résultat, flux de trésorerie, notes (art. 8) ; second jeu IFRS si appel public à l'épargne ou cotation.
- Analytique : axes centre de coût, centre de profit, projet, produit, portés par les lignes.

## 6. Architecture fiscale (livrable 7)
Moteur de règles datées : fait générateur → assiette → taux → compte → déclaration → échéance. Chaque calcul conserve la version de la règle. Les déclarations sont des documents préparés puis validés ; **aucun envoi automatique** à l'administration au départ. La facturation électronique camerounaise est à qualifier avant de concevoir la facturation.

## 7. Multi-filiales (livrable 11)
Une comptabilité par **entité juridique**. Investudy n'est une entité distincte que s'il a sa personnalité juridique (à confirmer) ; sinon c'est un centre de profit. Opérations intra-groupe : tiers marqués « groupe », double écriture rapprochée, écarts signalés. Consolidation : périmètre daté, méthode selon le contrôle, retraitements, éliminations (art. 74 et suivants).

## 8. Multi-devises (livrable 12)
XAF, XOF, EUR, USD, GBP, et table ouverte. Chaque ligne garde le montant d'origine, la devise, le taux, sa source, le montant en devise légale de l'entité (art. 17) ; le montant de reporting se calcule avec un taux daté. Écarts de change réalisés et latents comptabilisés par processus dédié. XAF et XOF sont deux devises distinctes, même à parité identique avec l'euro [à valider].

## 9. Architecture documentaire (livrable 8)
Chaîne commune : données sources → brouillon → validation → numéro → émission figée avec empreinte → envoi → archive. Durée : **10 ans** pour les livres et pièces comptables (AUDCIF art. 24) ; pour les autres, 10 ans proposés et **à valider**.

| Document | Sources | Validation proposée | Fondement |
|---|---|---|---|
| Devis | Offre CRM | Chargé de compte, puis RAF au-delà d'un seuil | À valider |
| Facture, avoir | Devis, agrément, inscription | Comptable puis RAF | Pièce comptable ; fiscalité |
| Demande d'achat | Service | Responsable puis budget | Contrôle interne |
| Bon de commande | Demande approuvée | RAF ou DAF selon seuil | Contrôle interne |
| Bon de réception, bon de sortie | Livraison, mouvement | Demandeur différent de l'acheteur | Contrôle interne |
| Ordre de paiement | Facture rapprochée | **Deux signataires** | Contrôle interne |
| Journaux, grand livre, balance | Écritures | Figés à la clôture | Art. 19, 22 |
| États financiers | Balance | DAF puis organe compétent | Art. 8, 23 |
| Rapport de gestion | Pilotage | Direction | À préciser |
| Rapport de contrôle interne | Contrôles | Responsable conformité | COSUMAF art. 288, si agréé |

## 10. RBAC et séparation des tâches (livrable 9)
| Action | Comptable | RAF | Contrôleur de gestion | Auditeur | DAF | DG | DGA |
|---|---|---|---|---|---|---|---|
| Saisir | Oui | Oui | Non | Non | Non | Non | Non |
| Valider une écriture | Non | Oui | Non | Non | Oui | Non | Non |
| Clôturer une période | Non | Prépare | Non | Non | Oui | Non | Non |
| Préparer un paiement | Oui | Oui | Non | Non | Non | Non | Non |
| Signer un paiement | Non | 1re | Non | Non | 1re ou 2e | 2e | 2e par délégation |
| Budgets | Lit | Propose | Prépare | Lit | Valide | Approuve | Approuve par délégation |
| Paramétrer plan, taxes | Non | Propose | Non | Non | Valide | Non | Non |
| Lire livres et audit | Ses journaux | Tout | Tout sauf pièces sensibles | Tout | Tout | États et synthèses | États et synthèses |

Règles : nul ne valide ce qu'il a saisi ; qui crée un tiers ou change un compte bancaire ne paie pas ; l'auditeur ne peut rien écrire ; délégations datées ; second facteur récent pour signer.

**Limite :** avec une petite équipe, ces séparations supposent assez de personnes distinctes. Sinon il faut des contrôles compensatoires écrits. Nombre de personnes en finance : **à communiquer**.

## 11. Architecture d'audit (livrable 10)
Journal en ajout seul : acteur, rôle, action, objet, avant, après, heure, origine. Chaînage par empreinte et export périodique hors de la base [proposé]. Chemin de révision : état → solde → écriture → pièce → approbations (art. 22). Les droits SQL de l'application interdisent la modification des écritures validées et du journal ; l'accès d'administration à la base reste un risque à couvrir par des sauvegardes séparées.

## 12. Intégrations
| Source | Vers Finance | Retour |
|---|---|---|
| CRM | Entreprise facturable, offre acceptée, agrément, inscription confirmée, commission due | Facture émise, paiement, déblocage, versement |
| RH | Écritures de paie agrégées, avances et frais approuvés, indemnités | Remboursement effectué |
| Assets | Acquisition, mise en service, transfert, sortie | Numéro d'immobilisation, valeur nette |
| Banques | Relevés importés | Ordres exportés, sans émission automatique |

## 13. Inspirations Sage et ERP (livrable 14) — hypothèses à vérifier
| Domaine | Modèle courant chez Sage | Repris | Validations et contrôles | Piste d'audit visée |
|---|---|---|---|---|
| Générale | Saisie par journal et période, brouillard puis validation, clôture des journaux | Oui | Équilibre, période ouverte | Numéro et date de validation |
| Auxiliaire | Comptes tiers rattachés à un compte collectif, lettrage, échéances | Oui | Lettrage équilibré | Historique du lettrage |
| Immobilisations | Familles, plans d'amortissement, dotations générées | Oui | Plan cohérent avec la valeur | Calcul rejouable |
| Fiscalité | Codes taxes liés aux comptes et au registre | Oui, avec dates d'effet | Code obligatoire | Règle utilisée |
| Trésorerie | Import de relevés, rapprochement, prévision | Oui | Écart expliqué | Rapprochement signé |
| Budgets | Budgets par compte et section analytique | Oui | Disponible avant engagement | Versions |
| Contrôle de gestion | Plans analytiques multiples | Oui | Ventilation à 100 % | Clés datées |
| Reporting | États paramétrables | Oui | Concordance avec la balance | Version du modèle |
| Audit | Journalisation dépendante de l'édition | Renforcé | Immuabilité | Section 11 |

Sage X3, Dynamics 365 Finance et NetSuite inspirent le multi-sociétés et les approbations ; SAP Business One la traçabilité des documents liés ; Odoo la simplicité de saisie. **Aucune de ces affirmations n'est une comparaison vérifiée.**

Compatibilité Sage : import et export par fichiers à format paramétrable [forum Sage, à vérifier](https://communityhub.sage.com/fr/sage-100/f/discussion-generale/270253/import-fec) ; vocabulaire et ordre des colonnes familiers ; tables de correspondance des comptes, journaux et tiers. Préalable : **connaître la version de Sage réellement utilisée** et obtenir un export réel anonymisé.

## 14. Matrice de conformité (livrable 13)
« — » : aucune source identifiée à ce stade. Sage et ERP : usages supposés.

| Fonction | OHADA | CEMAC | COSUMAF | Sage | ERP internationaux | Pourquoi elle existe |
|---|---|---|---|---|---|---|
| Écritures immuables | art. 20, 22 | — | art. 277 (indirect) | Validation | Standard | Preuve |
| Clôtures | art. 19, 22, 23 | — | — | Clôture | Standard | Obligation |
| Conservation | art. 24 | Blanchiment, à lire | art. 105 | Archivage | Standard | Obligation |
| Tiers et vigilance | — | 02/24 | art. 105 | Hors cœur comptable | Modules | Blanchiment |
| Devises | art. 17 | 02/18 | — | Multi-devises | Standard | Obligation et activité |
| Facturation | art. 17 (pièces) | — | — | Gestion commerciale | Standard | Fiscalité |
| Paiements à deux signatures | art. 6 (contrôle interne) | 02/18 si devises | art. 287 | Selon édition | Standard | Fraude |
| Immobilisations | art. 36, 37 | — | — | Module | Standard | Évaluation |
| Budgets | — | — | — | Module | Standard | Pilotage, pas une obligation |
| Consolidation | art. 74 à 77 | — | — | Édition ou outil tiers | Standard | Groupe |
| Contrôle interne | art. 6 | — | art. 287 à 290 | — | Modules | Obligation si agréé |
| Prudentiel | — | — | art. 265 à 270 | — | — | Seulement si intermédiaire |

## 15. Feuille de route (livrable 15) — sans date
| Lot | Contenu | Condition de passage |
|---|---|---|
| F0 | Statut juridique, expert désigné, arbitrage construire ou acheter, état actuel de la comptabilité | Réponses écrites |
| F1 | Référentiels, identité, audit, import d'un exercice réel | Balance identique à la source |
| F2 | Facturation et encaissements reliés au CRM, commissions | Un mois facturé en parallèle |
| F3 | Trésorerie, rapprochement, fiscalité | Déclaration préparée égale à celle de l'expert |
| F4 | Comptabilité complète et clôtures (ou raccordement au logiciel choisi) | Un exercice clos validé |
| F5 | Achats, immobilisations, budgets | Selon besoin |
| F6 | Consolidation, reporting réglementaire, nouvelles juridictions | Seconde entité réelle |

## 16. Risques réglementaires (livrable 17)
| Risque | Parade |
|---|---|
| Statut mal qualifié : obligations oubliées ou construites pour rien | F0 avant tout |
| Texte périmé ou mal lu | Référentiel daté, valideur, revue à chaque loi de finances |
| Comptabilité non probante | Immuabilité, numérotation, test de clôture |
| Facturation non conforme | Qualifier la facturation électronique |
| Séparation des tâches impossible à effectif réduit | Contrôles compensatoires |
| Données personnelles et paie | Agrégats seulement ; avis juridique |
| Dépendance à un développeur seul | Logiciel éprouvé pour le cœur, documentation, passation |
| Perte de données | Sauvegardes séparées et restauration testée |

## 17. Recommandations à long terme (livrable 18)
- Une nouvelle juridiction s'ajoute par données (plan, règles, états), pas par code spécifique.
- Séparer le référentiel comptable (SYSCOHADA, IFRS) des faits économiques.
- Ne pas anticiper les métiers titres ou gestion d'actifs sans agrément ni besoin daté.
- Viser 10 à 15 ans par des formats d'export ouverts : pouvoir **quitter** n'importe quel outil, y compris le nôtre.
- Revoir le référentiel au moins une fois par an.

## 18. Couverture des livrables
| Livrables | État |
|---|---|
| 1 | Version 0 partielle (document 01) |
| 2, 3, 4, 8, 9, 15, 16, 17, 18 | Première version |
| 5, 6, 7, 10, 11, 12 | Principes ; modèle détaillé à faire |
| 13, 14 | Ébauche ; sources Sage et ERP à vérifier |
