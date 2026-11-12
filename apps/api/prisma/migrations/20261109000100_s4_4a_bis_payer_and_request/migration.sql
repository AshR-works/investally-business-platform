-- S4.4a-bis : payeur tiers facultatif (D41, FD-3) et agrément seulement demandé (D41, FD-4).

-- CreateEnum
CREATE TYPE "bd"."ApprovalPayerType" AS ENUM ('EMPLOYER', 'ORGANISM', 'LANDLORD');

-- Un agrément demandé n'a pas encore de date de réception.
ALTER TABLE "bd"."approvals" ALTER COLUMN "received_on" DROP NOT NULL;

-- Payeur tiers : nom et type vont ensemble ; aucun des deux = le client paie lui-même.
ALTER TABLE "bd"."approvals" ADD COLUMN "payer_name" VARCHAR(200);
ALTER TABLE "bd"."approvals" ADD COLUMN "payer_type" "bd"."ApprovalPayerType";
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_payer_complete" CHECK (COALESCE(("payer_name" IS NULL) = ("payer_type" IS NULL), false));
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_payer_name_not_blank" CHECK (COALESCE("payer_name" IS NULL OR length(btrim("payer_name")) > 0, false));

-- UN SEUL agrément actif (demandé, reçu ou honoré) par opportunité.
DROP INDEX "bd"."approvals_one_active_per_opportunity";
CREATE UNIQUE INDEX "approvals_one_active_per_opportunity" ON "bd"."approvals"("opportunity_id") WHERE "status" IN ('REQUESTED', 'RECEIVED', 'HONORED');

-- La date de réception manque seulement à un agrément demandé, ou annulé avant d'avoir été reçu.
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_received_on_required" CHECK (COALESCE("received_on" IS NOT NULL OR "status" IN ('REQUESTED', 'CANCELLED'), false));

-- La fin de validité ne précède pas la réception (quand elle est connue).
ALTER TABLE "bd"."approvals" DROP CONSTRAINT "approvals_validity_after_receipt";
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_validity_after_receipt" CHECK (COALESCE("valid_until" IS NULL OR "received_on" IS NULL OR "valid_until" >= "received_on", false));

-- Demandé ou reçu, l'agrément n'est pas clos ; honoré, expiré ou annulé, il a sa date de clôture ; expiré ou annulé, il a aussi son motif.
ALTER TABLE "bd"."approvals" DROP CONSTRAINT "approvals_closure_coherent";
ALTER TABLE "bd"."approvals" ADD CONSTRAINT "approvals_closure_coherent" CHECK (
  COALESCE(
    ("status" IN ('REQUESTED', 'RECEIVED')) = ("closed_at" IS NULL)
    AND (("status" IN ('EXPIRED', 'CANCELLED')) = ("closed_reason" IS NOT NULL)),
    false
  )
);
