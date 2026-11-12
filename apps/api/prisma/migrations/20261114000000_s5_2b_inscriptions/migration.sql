-- S5.2b : apprenants et inscriptions aux sessions de formation.
CREATE TYPE "training"."EnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'TO_REPLACE');

CREATE TABLE "training"."learners" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "contact_id" UUID,
  "last_name" VARCHAR(100) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "name_key" VARCHAR(210) NOT NULL,
  "email" VARCHAR(200),
  "email_key" VARCHAR(200),
  "phone" VARCHAR(40),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "learners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training"."enrollments" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "learner_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "approval_id" UUID NOT NULL,
  "charged_amount" DECIMAL(14,2),
  "status" "training"."EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
  "comment" VARCHAR(500),
  "cancel_reason" VARCHAR(500),
  "confirmed_at" TIMESTAMPTZ(6),
  "replaced_by_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "learners_company_id_idx" ON "training"."learners"("company_id");
CREATE INDEX "learners_company_id_name_key_idx" ON "training"."learners"("company_id", "name_key");
CREATE INDEX "learners_company_id_email_key_idx" ON "training"."learners"("company_id", "email_key");
CREATE INDEX "enrollments_session_id_status_idx" ON "training"."enrollments"("session_id", "status");
CREATE INDEX "enrollments_learner_id_status_idx" ON "training"."enrollments"("learner_id", "status");
CREATE INDEX "enrollments_approval_id_status_idx" ON "training"."enrollments"("approval_id", "status");
CREATE INDEX "enrollments_company_id_idx" ON "training"."enrollments"("company_id");
-- Un apprenant n'a qu'une inscription vivante (en attente, confirmée ou à replacer) par session : garanti par la base.
CREATE UNIQUE INDEX "enrollments_one_live_per_learner_session" ON "training"."enrollments"("session_id", "learner_id") WHERE "status" <> 'CANCELLED';

ALTER TABLE "training"."learners" ADD CONSTRAINT "learners_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."learners" ADD CONSTRAINT "learners_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "bd"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training"."sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "training"."learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "bd"."approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "training"."enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Règles garanties par la base (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "training"."learners" ADD CONSTRAINT "learners_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."learners" ADD CONSTRAINT "learners_phone_format" CHECK (COALESCE("phone" IS NULL OR "phone" ~ '^\+?[1-9][0-9]{7,14}$', false));
ALTER TABLE "training"."learners" ADD CONSTRAINT "learners_email_key_coherent" CHECK (COALESCE(("email" IS NULL) = ("email_key" IS NULL), false));
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_charged_amount_positive" CHECK (COALESCE("charged_amount" IS NULL OR "charged_amount" > 0, false));
-- Le motif d'annulation est présent exactement quand l'inscription est annulée ; la date de confirmation, une inscription confirmée l'a toujours.
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_cancel_reason_coherent" CHECK (COALESCE(("status" = 'CANCELLED') = ("cancel_reason" IS NOT NULL), false));
ALTER TABLE "training"."enrollments" ADD CONSTRAINT "enrollments_confirmed_at_coherent" CHECK (COALESCE("status" <> 'CONFIRMED' OR "confirmed_at" IS NOT NULL, false));
