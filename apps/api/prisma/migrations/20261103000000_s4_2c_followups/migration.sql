-- S4.2c : relances des offres en cours.

-- CreateEnum
CREATE TYPE "bd"."FollowupChannel" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'OTHER');
CREATE TYPE "bd"."FollowupStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "bd"."followups" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "channel" "bd"."FollowupChannel" NOT NULL,
    "note" VARCHAR(500),
    "status" "bd"."FollowupStatus" NOT NULL DEFAULT 'PLANNED',
    "result_note" VARCHAR(1000),
    "closed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "followups_offer_id_idx" ON "bd"."followups"("offer_id");
-- La liste « À faire » parcourt les relances à faire par échéance.
CREATE INDEX "followups_planned_due_idx" ON "bd"."followups"("due_on") WHERE "status" = 'PLANNED';

-- Une relance porte sur une offre du même contexte.
ALTER TABLE "bd"."followups" ADD CONSTRAINT "followups_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "bd"."offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verrou optimiste : la version est toujours positive.
ALTER TABLE "bd"."followups" ADD CONSTRAINT "followups_version_positive" CHECK ("version" >= 1);
-- Une relance à faire n'est pas close ; une relance terminée ou annulée a sa date de clôture ET son résultat ou son motif
-- (COALESCE : un résultat inconnu ne doit pas passer pour vrai).
ALTER TABLE "bd"."followups" ADD CONSTRAINT "followups_closure_coherent" CHECK (
  COALESCE(
    ("status" = 'PLANNED') = ("closed_at" IS NULL) AND ("status" = 'PLANNED') = ("result_note" IS NULL),
    false
  )
);
