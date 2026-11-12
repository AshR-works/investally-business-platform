-- S4.3 : opportunités commerciales (pipeline).

-- CreateEnum
CREATE TYPE "bd"."OpportunityStage" AS ENUM ('QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'AGREEMENT_IN_PRINCIPLE', 'ACCREDITATION');
CREATE TYPE "bd"."OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "bd"."OpportunitySource" AS ENUM ('PROSPECTING', 'REFERRAL', 'EVENT', 'INBOUND', 'OTHER');
CREATE TYPE "bd"."LossReason" AS ENUM ('PRICE', 'COMPETITOR', 'NO_BUDGET', 'NO_RESPONSE', 'NOT_INTERESTED', 'OTHER');

-- CreateTable
CREATE TABLE "bd"."opportunities" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "source" "bd"."OpportunitySource" NOT NULL,
    "stage" "bd"."OpportunityStage" NOT NULL DEFAULT 'QUALIFICATION',
    "status" "bd"."OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "loss_reason" "bd"."LossReason",
    "closing_note" VARCHAR(500),
    "closed_at" TIMESTAMPTZ(6),
    "waiver_reason" VARCHAR(500),
    "waived_at" TIMESTAMPTZ(6),
    "stage_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "opportunities_company_id_idx" ON "bd"."opportunities"("company_id");
CREATE INDEX "opportunities_status_stage_idx" ON "bd"."opportunities"("status", "stage");

ALTER TABLE "bd"."opportunities" ADD CONSTRAINT "opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verrou optimiste, montant positif.
ALTER TABLE "bd"."opportunities" ADD CONSTRAINT "opportunities_version_positive" CHECK ("version" >= 1);
ALTER TABLE "bd"."opportunities" ADD CONSTRAINT "opportunities_amount_positive" CHECK (COALESCE("amount" > 0, false));
-- Une opportunité ouverte n'est ni close ni motivée ; une perdue a sa date ET son motif ; une gagnée a sa date et aucun motif de perte
-- (COALESCE : un résultat inconnu ne doit pas passer pour vrai).
ALTER TABLE "bd"."opportunities" ADD CONSTRAINT "opportunities_closure_coherent" CHECK (
  COALESCE(
    CASE "status"
      WHEN 'OPEN' THEN "closed_at" IS NULL AND "loss_reason" IS NULL AND "closing_note" IS NULL
      WHEN 'LOST' THEN "closed_at" IS NOT NULL AND "loss_reason" IS NOT NULL
      WHEN 'WON' THEN "closed_at" IS NOT NULL AND "loss_reason" IS NULL AND "closing_note" IS NULL
    END,
    false
  )
);
-- Une opportunité gagnée a franchi l'accord de principe.
ALTER TABLE "bd"."opportunities" ADD CONSTRAINT "opportunities_won_after_agreement" CHECK (
  COALESCE("status" <> 'WON' OR "stage" IN ('AGREEMENT_IN_PRINCIPLE', 'ACCREDITATION'), false)
);
-- Dérogation : justification et date ensemble.
ALTER TABLE "bd"."opportunities" ADD CONSTRAINT "opportunities_waiver_coherent" CHECK (
  COALESCE(("waiver_reason" IS NULL) = ("waived_at" IS NULL), false)
);
