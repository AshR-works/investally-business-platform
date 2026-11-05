-- S4.4c : versements des commissions de facilitateur (flux F3), nés à l'honneur d'un agrément (D41, FD-1 B).

-- CreateEnum
CREATE TYPE "bd"."CommissionPayoutStatus" AS ENUM ('DUE', 'ON_HOLD', 'RELEASED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "bd"."commission_payouts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "facilitator_id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "commission_type" "bd"."CommissionType" NOT NULL,
    "commission_value" DECIMAL(12,2) NOT NULL,
    "commission_currency" CHAR(3),
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL,
    "status" "bd"."CommissionPayoutStatus" NOT NULL DEFAULT 'DUE',
    "hold_reason" VARCHAR(500),
    "cancelled_reason" VARCHAR(500),
    "paid_on" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commission_payouts_approval_id_key" ON "bd"."commission_payouts"("approval_id");
CREATE INDEX "commission_payouts_company_id_idx" ON "bd"."commission_payouts"("company_id");
CREATE INDEX "commission_payouts_facilitator_id_idx" ON "bd"."commission_payouts"("facilitator_id");
CREATE INDEX "commission_payouts_status_idx" ON "bd"."commission_payouts"("status");

ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "bd"."facilitators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "bd"."approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verrou optimiste : la version est toujours positive.
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_version_positive" CHECK ("version" >= 1);
-- La définition figée : valeur positive ; un pourcentage n'a pas de devise et ne dépasse pas 100 ; un montant fixe a sa devise.
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_commission_valid" CHECK (
  COALESCE("commission_value" > 0 AND (("commission_type" = 'PERCENT') = ("commission_currency" IS NULL)) AND ("commission_type" <> 'PERCENT' OR "commission_value" <= 100), false)
);
-- Un montant, quand il existe, est positif ; il est obligatoire dès que les fonds sont débloqués ou versés.
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_amount_positive" CHECK (COALESCE("amount" IS NULL OR "amount" > 0, false));
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_amount_before_release" CHECK (COALESCE("status" NOT IN ('RELEASED', 'PAID') OR "amount" IS NOT NULL, false));
-- Le motif d'attente existe exactement quand elle est en attente ; le motif d'annulation exactement quand elle est annulée ;
-- la date de versement exactement quand elle est versée.
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_hold_coherent" CHECK (COALESCE(("status" = 'ON_HOLD') = ("hold_reason" IS NOT NULL), false));
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_cancel_coherent" CHECK (COALESCE(("status" = 'CANCELLED') = ("cancelled_reason" IS NOT NULL), false));
ALTER TABLE "bd"."commission_payouts" ADD CONSTRAINT "commission_payouts_paid_coherent" CHECK (COALESCE(("status" = 'PAID') = ("paid_on" IS NOT NULL), false));
