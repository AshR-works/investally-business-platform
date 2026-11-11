-- Lot B (décision « option C », 2026-11-11) : apprenant sans entreprise (étudiant ou particulier) avec un payeur désigné (lui-même ou un tiers).
-- Les apprenants et inscriptions existants gardent leur sens : kind = COMPANY, aucun payeur. Aucune clé étrangère vers un autre schéma (invariant des frontières).

CREATE TYPE "training"."LearnerKind" AS ENUM ('COMPANY', 'STUDENT', 'INDIVIDUAL');
CREATE TYPE "training"."EnrollmentPayerKind" AS ENUM ('SELF', 'THIRD_PARTY');
CREATE TYPE "training"."EnrollmentPayerType" AS ENUM ('EMPLOYER', 'ORGANISM', 'LANDLORD', 'FAMILY');

-- Apprenants : l'entreprise devient facultative, et seulement pour un étudiant ou un particulier.
ALTER TABLE "training"."learners" ADD COLUMN "kind" "training"."LearnerKind" NOT NULL DEFAULT 'COMPANY';
ALTER TABLE "training"."learners" ALTER COLUMN "company_id" DROP NOT NULL;
ALTER TABLE "training"."learners" ADD CONSTRAINT "learners_kind_company_coherent" CHECK (COALESCE(
  ("kind" = 'COMPANY' AND "company_id" IS NOT NULL)
  OR ("kind" <> 'COMPANY' AND "company_id" IS NULL AND "contact_id" IS NULL), false));
CREATE INDEX "learners_kind_name_key_idx" ON "training"."learners"("kind", "name_key");

-- Inscriptions : soit un agrément d'entreprise couvre l'inscription, soit un payeur est désigné (lui-même ou un tiers nommé, avec son type) ; jamais les deux, jamais aucun.
-- Sans entreprise, le montant dû (prix complet du certificat, recopié) est obligatoire.
ALTER TABLE "training"."enrollments" ALTER COLUMN "company_id" DROP NOT NULL;
ALTER TABLE "training"."enrollments" ALTER COLUMN "approval_id" DROP NOT NULL;
ALTER TABLE "training"."enrollments" ADD COLUMN "payer_kind" "training"."EnrollmentPayerKind";
ALTER TABLE "training"."enrollments" ADD COLUMN "payer_name" VARCHAR(200);
ALTER TABLE "training"."enrollments" ADD COLUMN "payer_type" "training"."EnrollmentPayerType";
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_payer_coherent" CHECK (COALESCE(
  ("company_id" IS NOT NULL AND "approval_id" IS NOT NULL AND "payer_kind" IS NULL AND "payer_name" IS NULL AND "payer_type" IS NULL)
  OR ("company_id" IS NULL AND "approval_id" IS NULL AND "charged_amount" IS NOT NULL AND "payer_kind" = 'SELF' AND "payer_name" IS NULL AND "payer_type" IS NULL)
  OR ("company_id" IS NULL AND "approval_id" IS NULL AND "charged_amount" IS NOT NULL AND "payer_kind" = 'THIRD_PARTY' AND "payer_name" IS NOT NULL AND length(btrim("payer_name")) > 0 AND "payer_type" IS NOT NULL), false));
