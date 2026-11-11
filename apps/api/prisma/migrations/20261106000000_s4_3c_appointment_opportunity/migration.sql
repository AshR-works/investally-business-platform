-- S4.3c : lien facultatif d'un rendez-vous à une opportunité (D93).
ALTER TABLE "bd"."appointments" ADD COLUMN "opportunity_id" UUID;
CREATE INDEX "appointments_opportunity_id_idx" ON "bd"."appointments"("opportunity_id");
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "bd"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
