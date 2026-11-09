# ADR-0009 — RH légère dans le CRM, RH sensible à l'ERP

| | |
|---|---|
| **Statut** | Accepté (2026-11-09, décisions D55 à D58 de la Direction produit : « applique les recommandations »). **Amende l'ADR-0005.** |
| **Contexte** | L'ADR-0005 range la RH dans l'ERP, produit séparé à base séparée, non construit. Le sprint MVP demande une section Ressources humaines utilisable cette semaine ; l'ERP n'existe pas et l'hébergement n'est pas décidé. |
| **Lié à** | `docs/cadrages/CADRAGE-RH.md`, ADR-0005, D27 (DGA = Direction + RH), DEC-006 (performance après avis juridique), D11 et D65 (données personnelles) |

## Options considérées
1. **Statu quo** : RH dans l'ERP, non construit. Conforme à l'ADR-0005, mais **ne répond pas à la demande du sprint**.
2. **Module RH dans le CRM, schéma `hr` isolé, sans donnée sensible (retenue)** : livrable cette semaine, aucun nouveau déploiement.
3. **Application ERP séparée dès maintenant** : conforme à l'ADR-0005, mais deux déploiements et un IAM à dupliquer ou à fédérer, avec un hébergement non décidé : intenable dans le délai.

## Décision
- La **RH légère** vit dans le CRM : annuaire du personnel, organigramme, puis absences et congés. Module `hr` du monolithe modulaire, **schéma PostgreSQL `hr` propre**, aucune clé étrangère vers un autre schéma (invariant des frontières, test `core-schema`), références par identifiant, lectures des autres modules par **interface publique** (`index.ts`).
- La **RH sensible reste à l'ERP** : paie, salaires, pièces d'identité, adresse personnelle, date de naissance, situation familiale, santé, évaluations et performance. **Aucune de ces données n'entre dans le CRM** tant que l'avis juridique (D11, D65) et l'ERP n'existent pas.
- Employé et utilisateur sont **deux entités** (lien facultatif). L'organigramme RH **ne modifie pas** `users.manager_id` : il signale les écarts.
- Mêmes garde-fous que le reste du CRM : MFA obligatoire, permissions `hr.employee.*` avec portée, hors portée = « introuvable », audit avant/après, archivage réversible (jamais de suppression), verrou de version.

## Conséquences
- (+) La RH est utilisable sans attendre l'ERP ; un seul menu, un seul compte.
- (−) Les données de l'annuaire du personnel partagent la base et les sauvegardes du CRM (limité par l'exclusion des données sensibles).
- (−) **Dette D162** : migrer les données `hr` vers l'ERP à sa création ; la frontière de module et le schéma propre rendent l'extraction possible, rien ne la garantit.
- À revoir si : une donnée sensible devient nécessaire (alors l'ERP d'abord), ou si l'hébergement impose une séparation des bases de données.
