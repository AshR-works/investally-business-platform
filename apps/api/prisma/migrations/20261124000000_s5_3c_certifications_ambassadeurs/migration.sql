-- CreateEnum
CREATE TYPE "training"."CertificationKind" AS ENUM ('CERTIFICATE', 'ATTESTATION');
CREATE TYPE "training"."CertificationStatus" AS ENUM ('ISSUED', 'REVOKED');

-- Séquence des numéros de référence (CU-I-64 : valeur de départ « à confirmer », sans vérification externe).
CREATE SEQUENCE "training"."certification_reference_seq" START 1;

-- CreateTable
CREATE TABLE "training"."certifications" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "kind" "training"."CertificationKind" NOT NULL,
    "reference_number" VARCHAR(40) NOT NULL,
    "status" "training"."CertificationStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_by_user_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_by_user_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certifications_enrollment_id_key" ON "training"."certifications"("enrollment_id");
CREATE UNIQUE INDEX "certifications_reference_number_key" ON "training"."certifications"("reference_number");

ALTER TABLE "training"."certifications" ADD CONSTRAINT "certifications_revoke_coherent" CHECK (
  ("status" = 'ISSUED' AND "revoked_by_user_id" IS NULL AND "revoked_at" IS NULL AND "revoke_reason" IS NULL) OR
  ("status" = 'REVOKED' AND "revoked_by_user_id" IS NOT NULL AND "revoked_at" IS NOT NULL AND COALESCE(length(btrim("revoke_reason")) > 0, false))
);

-- AddForeignKey
ALTER TABLE "training"."certifications" ADD CONSTRAINT "certifications_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "training"."ambassador_suggestions" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_suggestions_enrollment_id_key" ON "training"."ambassador_suggestions"("enrollment_id");
CREATE INDEX "ambassador_suggestions_owner_user_id_idx" ON "training"."ambassador_suggestions"("owner_user_id");

-- AddForeignKey
ALTER TABLE "training"."ambassador_suggestions" ADD CONSTRAINT "ambassador_suggestions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
