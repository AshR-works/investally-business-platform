-- S4.2b : décharges signées des offres.

-- CreateEnum
CREATE TYPE "bd"."ReceiptStatus" AS ENUM ('VALID', 'CANCELLED');

-- CreateTable
CREATE TABLE "bd"."receipts" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "received_on" DATE NOT NULL,
    "received_by" VARCHAR(150) NOT NULL,
    "status" "bd"."ReceiptStatus" NOT NULL DEFAULT 'VALID',
    "cancelled_reason" VARCHAR(500),
    "cancelled_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "receipts_offer_id_idx" ON "bd"."receipts"("offer_id");

-- Une décharge porte sur une offre du même contexte.
ALTER TABLE "bd"."receipts" ADD CONSTRAINT "receipts_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "bd"."offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- UNE SEULE décharge valide par offre, quoi que fasse l'application (deux enregistrements simultanés : le second est refusé).
CREATE UNIQUE INDEX "receipts_one_valid_per_offer" ON "bd"."receipts"("offer_id") WHERE "status" = 'VALID';

-- Verrou optimiste : la version est toujours positive.
ALTER TABLE "bd"."receipts" ADD CONSTRAINT "receipts_version_positive" CHECK ("version" >= 1);
-- Une décharge annulée garde son motif et sa date ; une décharge valide n'en a pas (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "bd"."receipts" ADD CONSTRAINT "receipts_cancellation_coherent" CHECK (
  COALESCE(
    ("status" = 'CANCELLED') = ("cancelled_reason" IS NOT NULL) AND ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL),
    false
  )
);
