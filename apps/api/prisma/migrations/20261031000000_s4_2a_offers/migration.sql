-- S4.2a : offres faites aux entreprises.

-- CreateEnum
CREATE TYPE "bd"."OfferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIPT_RECEIVED', 'ACCEPTED', 'REFUSED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "bd"."offers" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "company_id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "bd"."OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "note" VARCHAR(1000),
    "submitted_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "withdrawn_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd"."offer_counters" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,
    CONSTRAINT "offer_counters_pkey" PRIMARY KEY ("year")
);

CREATE UNIQUE INDEX "offers_reference_key" ON "bd"."offers"("reference");
CREATE INDEX "offers_company_id_idx" ON "bd"."offers"("company_id");
CREATE INDEX "offers_status_idx" ON "bd"."offers"("status");

-- Une offre appartient à une entreprise du même contexte.
ALTER TABLE "bd"."offers" ADD CONSTRAINT "offers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Règles garanties par la base, quoi que fasse l'application (COALESCE : un résultat inconnu ne doit pas passer pour vrai).
ALTER TABLE "bd"."offers" ADD CONSTRAINT "offers_version_positive" CHECK ("version" >= 1);
ALTER TABLE "bd"."offers" ADD CONSTRAINT "offers_amount_positive" CHECK ("amount" > 0);
-- Une offre déposée (ou au-delà) a une date de dépôt ; un brouillon n'en a pas.
ALTER TABLE "bd"."offers" ADD CONSTRAINT "offers_submitted_at_coherent" CHECK (
  COALESCE(("status" = 'DRAFT') = ("submitted_at" IS NULL), false) OR "status" = 'WITHDRAWN'
);
-- Une offre retirée garde son motif.
ALTER TABLE "bd"."offers" ADD CONSTRAINT "offers_withdrawn_reason_required" CHECK (
  COALESCE(("status" = 'WITHDRAWN') = ("withdrawn_reason" IS NOT NULL), false)
);
