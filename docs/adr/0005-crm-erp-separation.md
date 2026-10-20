# ADR-0005 — CRM séparé de l'ERP, CRM prioritaire

- **Statut** : Proposé (2026-10-20, Sprint 1) — amende l'ADR-0001
- **Décideurs** : Direction produit, Tech Lead, Architecte

## Contexte
Décision produit : le CRM est la priorité et doit être séparé de l'ERP. Périmètre CRM confirmé : pipeline commercial **et Investudy complet** (programmes, sessions, salles, formateurs, apprenants, inscriptions, présences, évaluations, certifications). L'ERP regroupe Finance, RH, Fiscalité et le reporting de direction. Le niveau de séparation n'a pas été imposé ; l'option recommandée est retenue.

## Décision
1. Le dépôt reste un **monorepo** avec deux produits déployables indépendamment :
   - `apps/crm-api` + `apps/crm-web` : **CRM** (livré en premier) ;
   - `apps/erp-api` + `apps/erp-web` : **ERP** (créé plus tard, pas de squelette vide d'ici là).
2. **Une base PostgreSQL par produit**, aucune lecture croisée. Les produits s'échangent des **événements** versionnés (contrats documentés), jamais de requêtes sur la base de l'autre.
3. Chaque produit reste un **monolithe modulaire** (ADR-0001 s'applique à l'intérieur de chaque produit) avec la même discipline Clean Architecture.
4. **Pas de paquets partagés tant que l'ERP n'existe pas.** Le CRM embarque son propre IAM, son audit et ses documents. À la création de l'ERP, on extraira ce qui est réellement commun (`shared-kernel`, contrats d'événements, authentification) vers `packages/`, ou on introduira un fournisseur d'identité unique (SSO/OIDC). Pour que cette extraction reste peu coûteuse : jetons JWT standards, identifiants utilisateur en UUID, événements d'intégration définis comme contrats.
5. Frontière CRM → ERP : le CRM publie `EnrollmentConfirmed` (et autres faits utiles à la finance) via l'outbox. L'ERP les consommera plus tard ; d'ici là ils s'accumulent sans bloquer le CRM.

## Conséquences
- (+) Le CRM est livrable et utilisable seul, sans attendre Finance/RH/Fiscalité.
- (+) Blast radius réduit : un incident ou un changement ERP n'affecte pas le CRM, et inversement ; droits d'accès à la base séparés (données RH et financières hors de portée du CRM).
- (−) Duplication temporaire de l'IAM/audit (assumée, voir point 4).
- (−) Cohérence éventuelle entre produits : les rapports de direction transversaux (vue 360°) viendront d'événements, pas de jointures.
- (−) Deux pipelines de déploiement et de migrations à terme.
- Le dashboard Direction « vue 360° » devient un cas d'intégration ERP ← CRM ; le CRM expose ses propres KPI.

## Alternatives rejetées
- Un seul déploiement avec priorité différente : ne répond pas à la demande de séparation.
- Base partagée avec schémas séparés : séparation des droits et des migrations moins nette.
- Deux dépôts / deux IAM totalement indépendants : duplication maximale et intégration plus coûteuse, injustifiée pour une seule équipe.

## À revoir si
Une équipe distincte prend l'ERP (alors extraire l'IAM en service dédié) ou si le volume d'événements justifie un broker (voir déclencheurs de la Phase 3).
