# Cadrage — section Ressources humaines (RH)

*2026-11-09 · suite des lots N1 à N6 (D54 : « puis la section Ressources humaines ») · méthode [METHODE-D-ARBITRAGE](../METHODE-D-ARBITRAGE.md). **Aucune ligne de code RH n'existe** : ce document propose, la Direction produit décide. Les valeurs « par défaut » sont des hypothèses à confirmer, jamais des règles métier ni des avis juridiques (D11).*

## 1. Question

Le sprint MVP de la semaine demande une section **Ressources humaines** utilisable. Or, aujourd'hui, la RH est **décidée hors du CRM** : elle appartient à l'ERP, produit séparé avec sa propre base (ADR-0005), et le rôle `HR` n'a « aucun accès métier » (RBAC). Il faut donc trancher **où elle vit**, **ce qu'elle couvre**, **comment elle se relie aux comptes**, et **quelles données y sont admises**. Quatre décisions (D55 à D58 proposées), puis les règles métier que je ne connais pas.

## 2. Ce qui existe déjà (et contraint)

| Fait | Source | Effet sur RH |
|---|---|---|
| CRM et ERP sont **deux produits**, une base chacun, échange par événements ; l'ERP regroupe Finance, **RH**, Fiscalité, reporting de direction | ADR-0005 | Mettre la RH dans le CRM **amende** cet ADR |
| « Employé (salarié, RH) **≠** Utilisateur (compte IAM) », nom prévu `hr.Employee` | ARCHITECTURE (glossaire) | L'employé est une entité **distincte** du compte |
| Le rôle `HR` : MFA obligatoire, **aucun accès métier CRM** ; la DGA cumule **Direction + RH** (D27) | RBAC, D27 | Les permissions RH sont à créer ; la DGA les aurait par cumul |
| `users.manager_id` existe et **pilote la portée « Équipe »** de tous les droits | schéma IAM | Un organigramme RH qui divergerait de ce lien créerait deux vérités |
| Suivi de **performance des employés** : seulement après avis juridique et RH | DEC-006 | **Hors périmètre** |
| Durées de conservation et loi applicable sur les données personnelles **non validées** | D11, D65 | Aucune donnée sensible sans avis ; suppression logique seulement |
| RH, Finance, Fiscalité « **non construits, hors périmètre initial** » | PLAN-DE-MISE-EN-PRODUCTION | Le sprint MVP **change** ce périmètre : à consigner |
| Hébergement et mise en production **non décidés** | D-PROD | Où seraient stockées des données RH est une question ouverte |
| Archivage réversible, jamais de suppression ; verrou de version ; audit avant/après ; IDOR « introuvable » | N5, S5.x | Même socle technique, réutilisable tel quel |

## 3. D55 — Où vit la section RH ?

| | Option | Avantages | Inconvénients | Impacts | Réversibilité |
|---|---|---|---|---|---|
| **A** | **Statu quo** : RH reste dans l'ERP, non construit | Aucun écart à l'ADR, aucune donnée RH dans le CRM | **Ne répond pas à la demande du sprint** | Aucun | Totale |
| **B** | **Module RH dans le CRM**, schéma `hr` isolé, mêmes base et IAM, frontière de module stricte (comme `COMPANY_DIRECTORY`) | Livrable cette semaine ; aucun nouveau déploiement ; un seul menu, un seul compte | Amende ADR-0005 ; mêmes sauvegardes et même base que le commercial ; la RH grossit dans un produit prévu pour autre chose | Nouveau module API + écrans, une migration, nouvelles permissions `hr.*`, un ADR (0009) | Bonne : la frontière de module permet l'extraction vers l'ERP |
| **C** | **Application ERP séparée dès maintenant** (`erp-api`, `erp-web`, base propre) | Conforme à l'ADR-0005 ; isolement maximal des données RH | Deux déploiements, IAM à dupliquer ou SSO à construire, hébergement non décidé : **intenable en une semaine** | Deux nouvelles applications, pipeline, authentification | Bonne, mais très coûteuse à défaire |

**Grille** (poids de 1 à 5, notes de 1 à 5, maximum 95) :

| Critère | Poids | A | B | C |
|---|---|---|---|---|
| Répond à la demande du sprint (RH utilisable cette semaine) | 5 | 1 | 5 | 2 |
| Conformité aux décisions existantes (ADR-0005) | 4 | 5 | 2 | 5 |
| Protection des données personnelles (isolement) | 4 | 5 | 3 | 5 |
| Réversibilité et dette | 3 | 5 | 3 | 4 |
| Coût d'exploitation et d'hébergement | 3 | 5 | 5 | 1 |
| **Total** | | **75** | **69** | **65** |

*Calculs : A = 5×1 + 4×5 + 4×5 + 3×5 + 3×5 = 75 ; B = 5×5 + 4×2 + 4×3 + 3×3 + 3×5 = 69 ; C = 5×2 + 4×5 + 4×5 + 3×4 + 3×1 = 65.*

**Écart entre la grille et la recommandation.** A a le meilleur total parce que ne rien faire ne coûte rien ; mais A échoue sur le critère qui est une **exigence ferme** (RH dans le MVP). Entre les options qui répondent à la demande, **B (69) devance C (65)**.

**Recommandation : B**, **à deux conditions** qui réduisent son défaut principal : (1) **aucune donnée sensible dans le CRM** (D57) ; (2) un **ADR-0009** qui amende l'ADR-0005 : « RH légère (annuaire, organigramme, absences) dans le CRM ; RH sensible (paie, salaires, pièces d'identité, performance) reste à l'ERP ».

**Risques de B** : la RH s'installe dans le CRM et l'extraction n'a jamais lieu (dette) ; une fuite de la base CRM expose l'annuaire du personnel (limité par D57) ; l'hébergement non décidé (D-PROD) s'applique aussi à ces données. **Dette créée** : migration future des données `hr` vers l'ERP (**D162**).

## 4. D56 — Que couvre la section RH au MVP ?

| | Périmètre | Contenu |
|---|---|---|
| **1** | **Annuaire et organigramme** | Fiche employé (identité professionnelle, poste, service, responsable, date d'entrée, statut actif / sorti), liste, fiche, organigramme, archivage réversible, lien facultatif vers un compte |
| **2** | **1 + absences et congés** | Demande, validation par le responsable, solde, calendrier d'équipe |
| **3** | **2 + dossier du personnel** | Contrats, période d'essai, documents RH, intégration et départ |
| **4** | **Complet** | Paie, présences, évaluations |

| Critère | Poids | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Valeur pour l'entreprise cette semaine | 5 | 3 | 4 | 4 | 5 |
| Faible risque sur les données personnelles | 4 | 5 | 4 | 2 | 1 |
| Tenable en une semaine | 5 | 5 | 3 | 2 | 1 |
| Peu de règles métier inconnues | 3 | 5 | 2 | 2 | 1 |
| Réversibilité | 2 | 5 | 4 | 3 | 1 |
| **Total** (maximum 95) | | **85** | **65** | **50** | **39** |

*Calculs : 1 = 15 + 20 + 25 + 15 + 10 = 85 ; 2 = 20 + 16 + 15 + 6 + 8 = 65 ; 3 = 20 + 8 + 10 + 6 + 6 = 50 ; 4 = 25 + 4 + 5 + 3 + 2 = 39.* Le périmètre 4 est de toute façon exclu : la performance attend l'avis juridique (DEC-006) et la paie relève de l'ERP.

**Recommandation : 1 cette semaine, puis 2 comme lot suivant** une fois les règles de congés fournies (§ 7). Le périmètre 1 est le seul qui ne dépend d'aucune règle que je ne connaisse pas ; les congés, si, et les inventer serait pire que les différer.

## 5. D57 — Données admises, droits et traces (recommandations, à confirmer)

- **Données admises (par défaut)** : identité **professionnelle** seulement : nom, prénom, matricule, poste, service, responsable, e-mail et téléphone professionnels, date d'entrée, statut, date et motif de sortie. **Exclus** : salaire, rémunération, pièces d'identité, adresse personnelle, date de naissance, situation familiale, données de santé, évaluations. Toute extension attend l'avis juridique (D11, D65).
- **Droits** (nouvelles permissions `hr.employee.*`, aucune autre) : le rôle **RH** (donc la DGA par cumul) lit, crée, modifie, archive, portée **Tous** ; la **Direction** lit, portée Tous ; le **Super administrateur** par `hr.*` ; **tout utilisateur authentifié** lit l'**annuaire restreint** (nom, poste, service, e-mail et téléphone professionnels) ; le responsable d'un employé voit sa fiche d'équipe ; **personne d'autre**. Hors portée : « introuvable », comme partout.
- **Traces** : création, modification et archivage audités avant/après ; **export audité** ; la **lecture** d'une fiche détaillée par la RH est tracée (action `VIEW`) ; archivage réversible, **jamais de suppression**.
- **Contrôles d'accès** : MFA déjà obligatoire pour tous les rôles ; hors portée = même réponse qu'un identifiant inexistant (classe IDOR « objet », sonde ajoutée au contrat).

## 6. D58 — Employé, utilisateur et organigramme

| | Option | Effet |
|---|---|---|
| **A** | Employé **=** utilisateur (étendre `iam.users`) | Une seule table ; mais l'annuaire serait limité aux gens qui ont un compte (les formateurs externes, sans compte, en seraient exclus) et les données RH entreraient dans l'IAM |
| **B** | Employé **distinct**, **lien facultatif** (0 ou 1) vers un utilisateur | Conforme au glossaire ; couvre les personnes sans compte ; deux sources à tenir |
| **C** | Employé distinct, **sans lien** | Simple ; mais on ne peut pas dire « cet utilisateur est telle personne » |

**Recommandation : B.** **Point de vigilance sur l'organigramme** : `users.manager_id` pilote la portée « Équipe » de tous les droits. L'**organigramme RH ne le modifie pas et ne le remplace pas** : le responsable d'un employé est une donnée RH (`manager_employee_id`) ; quand l'employé et son responsable ont tous deux un compte, la page **signale un écart** avec `users.manager_id` sans le corriger. Synchroniser les deux est une décision ultérieure, car elle changerait qui voit quoi dans tout le CRM.

## 7. Ce que je ne sais pas (questions pour vous)

1. **Qui gère le personnel** au quotidien : la DGA seule, ou un ou une assistante RH ? (cela décide du compte à créer et de la portée.)
2. **Structure** : la liste des services et l'organigramme réels (Direction, Commercial, Investudy, Finance, Support…), la **succursale Investudy** compte-t-elle comme un service distinct ? Un employé a-t-il **un seul** responsable ?
3. **Types de relation** : CDI, CDD, stagiaire, prestataire ? Les **formateurs externes** (sans compte) sont-ils dans l'annuaire du personnel ou restent-ils dans le catalogue Investudy ?
4. **Statuts** : actif, période d'essai, absent, sorti : lesquels voulez-vous voir ? Quel motif de sortie ?
5. **Matricule** : format souhaité, ou saisie libre ?
6. **Annuaire** : tous les utilisateurs doivent-ils voir tout le personnel (nom, poste, service, contacts professionnels), ou seulement leur service ?
7. **Congés et absences** (lot suivant) : jours par an, jours fériés applicables, qui valide, report des soldes, types d'absence.
8. **Reprise de données** : le personnel existe-t-il déjà dans un tableur ? Sinon je pars d'un jeu de démonstration fictif (fonctions, pas de noms réels).
9. **Données personnelles** : confirmez-vous l'exclusion par défaut du § 5, et savez-vous si un avis juridique est en cours (D11) ?
10. **Hébergement** : accepter d'avancer sur le module RH alors que le lieu de stockage de ces données n'est pas décidé ?

## 8. Plan proposé (après décision)

| Lot | Contenu | Taille estimée |
|---|---|---|
| **RH-0** | ADR-0009, décisions D55 à D58 au registre, mise à jour d'ARCHITECTURE, RBAC et du plan de production | court |
| **RH-1a** | Migration (schéma `hr`, `employees`, contraintes, index unique du matricule) ; domaine, cas d'usage, API (liste, fiche, création, modification, archivage), permissions, IDOR, audit | gros |
| **RH-1b** | Écrans : annuaire, fiche, organigramme, archivage, signalement d'écart avec la hiérarchie des comptes ; module « Ressources humaines » du menu ; jeu de démonstration fictif | moyen |
| **RH-1c** | Recette, tests (unitaires, intégration, mutants cette fois), fiches de test, dossier d'écrans | moyen |
| **RH-2** | Absences et congés (après les règles du § 7) | gros |

## 9. Décision attendue *(prise : voir § 10)*

Réponse courte, par exemple **« D55 B, D56 1 puis 2, D57 recommandations, D58 B »** ou « applique les recommandations ». Je ne commence **aucun code RH** avant votre réponse. Les questions du § 7 peuvent être répondues en une ligne chacune ; les défauts non contredits sont retenus « à confirmer ».

*Hors décision, à ne pas oublier : la section RH change le périmètre de la première mise en production (PLAN-DE-MISE-EN-PRODUCTION, ligne 18) ; je le consignerai au registre à la décision.*

## 10. Décision

**2026-11-09 — Direction produit : « Applique les recommandations. »** Retenus : **D55 B** (module RH dans le CRM, sans donnée sensible ; [ADR-0009](../adr/0009-rh-legere-dans-le-crm.md)), **D56 périmètre 1 puis 2** (absences après les règles de congés), **D57** (données professionnelles seulement, permissions `hr.employee.*`, annuaire restreint, traces), **D58 B** (employé distinct, lien facultatif, organigramme qui signale les écarts sans toucher à `users.manager_id`). Les dix questions du § 7 sont restées sans réponse : leurs **défauts sont retenus « à confirmer »** (D59) ; **la question 7 (règles de congés) n'a pas de défaut**, donc RH-2 attend.

**État** : RH-0 (registre D55 à D59, ADR-0009, ARCHITECTURE, RBAC, plan de production, dette D162) fait. **RH-1a** (API, commit `a63aba3`) et **RH-1b** (écrans Annuaire, Organigramme, Personnel et fiche, API des comptes à lier, bloc de démonstration « rh ») faits ; **RH-1c** (recette, mutants, fiches de test, dossier d'écrans) à lancer sur votre signal.
