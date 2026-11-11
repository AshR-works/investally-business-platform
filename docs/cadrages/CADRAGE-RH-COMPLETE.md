# Cadrage — la section RH « complète »

*2026-11-10 · Demande de la Direction produit : « RH complète » · Méthode : [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md) (options dont le statu quo, grille recalculée, recommandation, **décision laissée à la Direction produit**). Ce document nomme des **fonctions**, jamais des personnes : le dépôt est public. **Aucun code n'est écrit** tant que la décision n'est pas prise.*

## 1. La demande, et pourquoi elle se décompose
« RH complète » recouvre au moins six choses très différentes par leur **sensibilité**, leurs **règles inconnues** et leurs **dépendances externes**. Les traiter d'un bloc ferait porter à la section entière le risque de la plus sensible. Ce cadrage les sépare, dit ce qui est faisable tout de suite avec des valeurs par défaut, ce qui est contraint par vos propres décisions (ADR-0009, D55 à D58, DEC-006) et ce qui attend un tiers (avis juridique, antivirus, ERP).

## 2. Ce qui existe et ce qui contraint
| Fait | Source |
|---|---|
| **RH-1 livré** : annuaire, organigramme, fiche employé, archivage réversible, lien facultatif avec un compte, écarts de hiérarchie signalés | recette RH-1 |
| La RH vit **dans le CRM, schéma `hr`, sans donnée sensible** : jamais de salaire, pièce d'identité, adresse personnelle, date de naissance, santé | ADR-0009, D57 |
| La **RH sensible reste à l'ERP** (paie, salaires, pièces, évaluations) | ADR-0009 |
| Le **suivi de performance** attend l'**avis juridique** | DEC-006 |
| Les **règles de congés n'ont pas été communiquées** ; les valeurs par défaut sont retenues « à confirmer » | D59, § 7 de [CADRAGE-RH](CADRAGE-RH.md) |
| Les **documents** (contrats signés, pièces) exigent l'**antivirus** (D42, bloquant) et un stockage d'objets (D41) ; ils n'existent pas | PLAN-DE-MISE-EN-PRODUCTION |
| La **conservation** des données du personnel n'est pas validée juridiquement | D11, D65 |
| Une absence se rattache à un **employé qui a un compte** (le lien est facultatif aujourd'hui : 7 fiches de démonstration sur 11 en ont un) | RH-1 |

## 3. Les blocs de « RH complète »
| Bloc | Contenu | Sensibilité | Dépend de | État |
|---|---|---|---|---|
| **RH-2 Absences et congés** | Types d'absence, demande, validation par le responsable, solde, calendrier d'équipe, paramètres (jours par an, jours fériés) | Moyenne (une absence maladie est une donnée de santé indirecte : on ne stocke **jamais** de diagnostic) | Règles de congés (valeurs par défaut proposées § 5) | Faisable maintenant |
| **RH-3 Contrats et parcours** | Type de relation (CDI, CDD, stage, prestation), dates, période d'essai, fin de contrat, **liste de contrôle d'intégration et de départ** | Moyenne (sans salaire, sans pièce) | Types de contrat réels | Faisable après RH-2 |
| **RH-4 Présences** | Pointage, retards, heures | **Élevée** (surveillance des salariés) | Avis juridique, besoin réel à confirmer | Non recommandé maintenant |
| **RH-5 Dossier du personnel** | Documents RH : contrat signé, attestations, pièces | **Élevée** | **Antivirus (D42)**, stockage d'objets (D41), avis juridique | Bloqué |
| **RH-6 Évaluations et performance** | Entretiens, objectifs, notes | **Élevée** | **Avis juridique (DEC-006)** | Bloqué |
| **RH-7 Paie** | Salaires, bulletins, charges | **Très élevée** | **L'ERP** (ADR-0009) | Hors CRM |

## 4. Options et arbitrage
| Option | Contenu |
|---|---|
| **A. Statu quo** | RH-1 seulement (annuaire, organigramme, personnel) |
| **B. RH-2 seul** | A + absences et congés |
| **C. RH-2 puis RH-3** | B + contrats et parcours, **sans** documents ni données sensibles |
| **D. C + présences (RH-4)** | C + pointage |
| **E. Tout** (RH-2 à RH-7) | Contredit ADR-0009 et DEC-006 ; exige avant tout l'antivirus, le stockage d'objets, l'avis juridique et l'ERP |

| Critère (poids) | A | B | C | D | E |
|---|---|---|---|---|---|
| Valeur pour l'entreprise (5) | 1 | 4 | 5 | 5 | 5 |
| Faible risque sur les données personnelles (4) | 5 | 4 | 3 | 2 | 1 |
| Tenable à court terme (5) | 5 | 3 | 2 | 1 | 1 |
| Peu de règles métier inconnues (3) | 5 | 2 | 2 | 1 | 1 |
| Réversibilité (2) | 5 | 4 | 3 | 3 | 1 |
| **Total** (maximum 95) | **75** | **65** | **59** | **47** | **39** |

*Calculs : A = 5 + 20 + 25 + 15 + 10 = 75 ; B = 20 + 16 + 15 + 6 + 8 = 65 ; C = 25 + 12 + 10 + 6 + 6 = 59 ; D = 25 + 8 + 5 + 3 + 6 = 47 ; E = 25 + 4 + 5 + 3 + 2 = 39.*

**Écart entre la grille et la recommandation.** A a le meilleur total parce que ne rien faire ne coûte rien ; mais A échoue sur votre demande ferme (« RH complète »). Entre les options qui y répondent, **B devance C**, qui devance D, qui devance E.

**Recommandation : B maintenant, puis C comme lot suivant**, quand B est validé et que les types de contrat réels sont connus. **D, RH-5, RH-6 et RH-7 ne sont pas à faire** tant que l'avis juridique, l'antivirus, le stockage d'objets ou l'ERP n'existent pas : les construire d'abord serait faire porter au CRM ce que vos propres décisions réservent ailleurs. Je ne les « différe » pas par prudence de principe : chacun est **bloqué par une décision que vous avez déjà prise**.

## 5. RH-2 : ce que je propose (valeurs par défaut, toutes « à confirmer »)
Les règles réelles ne m'ont pas été données : **aucune n'est inscrite dans le code**. Toutes sont des **paramètres modifiables par la RH** (table de paramètres, changement tracé), initialisés à ces valeurs de départ.

### Types d'absence (paramétrables)
| Type | Décompté du solde | Remarque |
|---|---|---|
| Congé annuel | Oui | Le seul type qui consomme le solde |
| Maladie | Non | Un justificatif « reçu / non reçu » (case), **jamais de diagnostic ni de pièce** |
| Permission exceptionnelle | Non | Durée maximale par motif, paramétrable |
| Sans solde | Non | Validation obligatoire |
| Maternité et paternité | Non | Durées légales à valider (voir ci-dessous) |

### Règles
| Sujet | Valeur de départ | À valider avec |
|---|---|---|
| Acquisition | **1,5 jour par mois de service, soit 18 jours par an**, proratisé le mois d'entrée | Le droit du travail applicable ou le règlement intérieur : les guides publics se **contredisent** (18 ou 30 jours ; 12 ou 15 jours fériés) et ne sont pas des textes officiels. Référence à vérifier : la loi n° 92/007 du 14 août 1992 portant Code du travail et ses textes d'application |
| Jours comptés | **Jours ouvrés du lundi au vendredi** (la semaine de travail de l'entreprise) ; paramètre « ouvrés / ouvrables » | La RH |
| Jours fériés | Table **éditable par la RH**, **vide au départ** : je ne présume pas la liste | La RH |
| Demi-journées | Oui (0,5 jour) | La RH |
| Solde négatif | Interdit | La RH |
| Report du solde | Aucun report automatique ; la RH ajuste à la main (ajustement tracé, motif obligatoire) | La RH, la Direction |
| Chevauchement | Refusé (même employé) | — |
| Demande dans le passé | Réservée à la RH | La RH |

### Circuit
1. L'employé (compte lié) **demande** : type, dates, demi-journées, note facultative.
2. Son **responsable RH** (celui de l'organigramme) **valide ou refuse** ; un refus exige un motif. Sans responsable, **la RH valide**.
3. L'employé peut **annuler** avant le début ; après le début, seule la RH.
4. La RH peut **saisir pour un employé**, et **ajuster un solde** (motif obligatoire).
5. Toute transition est **auditée avant/après**.

### Droits et visibilité
| Qui | Voit |
|---|---|
| L'employé | Ses demandes et son solde |
| Le responsable | Les demandes de son équipe directe, avec leur type |
| La RH | Tout |
| La Direction | Tout, en lecture |
| Un collègue | Dans le **calendrier d'équipe**, seulement « absent » : **ni type, ni motif** |

Nouvelles permissions `hr.leave.read / create / approve / manage`, portées Propre, Équipe, Tous ; hors portée = « introuvable » (comme le reste du CRM), sonde ajoutée au contrat anti-IDOR. **Aucune notification par défaut** (l'envoi d'e-mails par le relais Google existe désormais : « demande à valider » est une option à décider).

### Écrans
**Mes absences** (demande, solde, historique) · **À valider** (pour les responsables) · **Calendrier d'équipe** · **Soldes** (RH) · **Paramètres RH** (types, jours fériés, acquisition ; RH et Super administrateur).

### Plan
| Lot | Contenu |
|---|---|
| **RH-2a** | Migration (`hr`, tables types, jours fériés, paramètres, demandes, ajustements ; contraintes et index), domaine, cas d'usage, API, permissions, IDOR, audit |
| **RH-2b** | Les cinq écrans, entrée de menu, jeu de démonstration fictif |
| **RH-2c** | Recette, tests (dont intégration), **mutants**, fiches de test |

## 6. Ce que je ne sais pas (à fournir quand vous le pourrez ; en attendant, les valeurs ci-dessus s'appliquent)
1. Le nombre de jours par an réellement accordé, et les jours fériés applicables.
2. Qui valide quand le responsable est absent (suppléant ?).
3. Le report des soldes d'une année sur l'autre.
4. Les types d'absence que vous voulez voir, et les durées de permission exceptionnelle.
5. Les types de contrat réels pour RH-3 (CDI, CDD, stagiaire, prestataire ; formateurs externes ou non).
6. Si une notification par e-mail à la demande est souhaitée.

## 7. Décision *(prise : voir § 8)*

## 8. Décision
**2026-11-10 — Direction produit : « B puis C ».** Retenu : **option B** (RH-2, absences et congés) **maintenant**, puis **option C** (RH-3, contrats et parcours, sans documents ni donnée sensible) comme lot suivant. **Exclus tant que leur condition n'est pas levée** : présences (RH-4), dossier du personnel (RH-5), évaluations (RH-6), paie (RH-7). Les valeurs par défaut du § 5 sont **appliquées « à confirmer »** (comme D59) ; les règles réelles, quand elles seront fournies, remplacent les valeurs de départ (ce sont des paramètres, pas du code). Enregistré en **D64**. **État (2026-11-10)** : **RH-2a livré** (API, base, droits, tests, mutants 126 sur 126) : [recette](../SPRINT-RH-2A-RECETTE.md) ; **RH-2b livré (2026-11-11)** : les cinq écrans, le menu et un jeu de démonstration fictif ([recette](../SPRINT-RH-2B-RECETTE.md)), avec la correction d'un défaut de RH-2a (le solde décomptait tous les types d'absence) ; RH-2c (recette, mutants de l'interface) à lancer **à votre signal**.
