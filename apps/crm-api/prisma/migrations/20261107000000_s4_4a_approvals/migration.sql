-- S4.4a : agréments (promesses de paiement signées) des opportunités.

-- CreateEnum
CREATE TYPE "bd"."ApprovalStatus" AS ENUM ('RECEIVED', 'HONORED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "bd"."approvals" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'XAF',
    "places" INTEGER,
    "received_on" DATE NOT NULL,
    "valid_until" DATE,
    "status" "bd"."ApprovalStatus" NOT NULL DEFAULT 'RECEIVED',
    "closed_reason" VARCHAR(500),
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approvals_company_id_idx" ON "bd"."approvals"("company_id");
CREATE INDEX "approvals_opportunity_id_idx" ON "bd"."approvals"("opportunity_id");

ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "bd"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- UN SEUL agrément actif (reçu ou honoré) par opportunité, quoi que fasse l'application (deux enregistrements simultanés : le second est refusé).
CREATE UNIQUE INDEX "approvals_one_active_per_opportunity" ON "bd"."approvals"("opportunity_id") WHERE "status" IN ('RECEIVED', 'HONORED');

-- Verrou optimiste : la version est toujours positive.
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_version_positive" CHECK ("version" >= 1);
-- Au moins une somme ou un nombre de places, tous deux positifs (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_amount_positive" CHECK (COALESCE("amount" IS NULL OR "amount" > 0, false));
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_places_positive" CHECK (COALESCE("places" IS NULL OR "places" > 0, false));
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_amount_or_places" CHECK (COALESCE("amount" IS NOT NULL OR "places" IS NOT NULL, false));
-- La fin de validité ne précède pas la réception.
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_validity_after_receipt" CHECK (COALESCE("valid_until" IS NULL OR "valid_until" >= "received_on", false));
-- Un agrément reçu n'est pas clos ; honoré, expiré ou annulé, il a sa date de clôture ; expiré ou annulé, il a aussi son motif ;
-- reçu ou honoré, il n'en a pas.
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_closure_coherent" CHECK (
  COALESCE(
    ("status" = 'RECEIVED') = ("closed_at" IS NULL)
    AND (("status" IN ('EXPIRED', 'CANCELLED')) = ("closed_reason" IS NOT NULL)),
    false
  )
);
