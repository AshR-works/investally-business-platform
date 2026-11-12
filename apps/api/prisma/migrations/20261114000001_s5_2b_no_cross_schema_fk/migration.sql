-- S5.2b (correctif) : aucune clé étrangère entre deux schémas PostgreSQL (invariant des frontières entre contextes, test core-schema).
-- Les apprenants et les inscriptions (schéma `training`) référencent entreprises, contacts et agréments (schéma `bd`) PAR IDENTIFIANT, comme les
-- autres références inter-contextes : l'existence et l'appartenance sont contrôlées par les cas d'usage (annuaire du module commercial), et rien
-- n'est jamais supprimé physiquement. Les index sur ces colonnes sont conservés.

ALTER TABLE "training"."learners" DROP CONSTRAINT "learners_company_id_fkey";
ALTER TABLE "training"."learners" DROP CONSTRAINT "learners_contact_id_fkey";
ALTER TABLE "training"."enrollments" DROP CONSTRAINT "enrollments_company_id_fkey";
ALTER TABLE "training"."enrollments" DROP CONSTRAINT "enrollments_approval_id_fkey";
