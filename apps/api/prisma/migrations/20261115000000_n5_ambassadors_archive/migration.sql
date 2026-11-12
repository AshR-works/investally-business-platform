-- N5 : archivage réversible des ambassadeurs (jamais de suppression). Un ambassadeur archivé garde son e-mail et son historique ; il se réactive.

CREATE TYPE "bd"."AmbassadorStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "bd"."ambassadors"
  ADD COLUMN "status" "bd"."AmbassadorStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "archive_reason" VARCHAR(500);

CREATE INDEX "ambassadors_status_idx" ON "bd"."ambassadors"("status");

-- Cohérence état / date d'archivage (COALESCE : un résultat inconnu ne passe pas pour vrai) : archivé a une date, actif n'a ni date ni motif.
ALTER TABLE "bd"."ambassadors" ADD CONSTRAINT "ambassadors_status_consistent" CHECK (COALESCE(
  ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL) OR ("status" = 'ACTIVE' AND "archived_at" IS NULL AND "archive_reason" IS NULL), false));
