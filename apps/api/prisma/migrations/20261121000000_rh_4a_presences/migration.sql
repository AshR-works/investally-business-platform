-- RH-4a : présences DÉCLARATIVES (D69, cadrage CADRAGE-RH-COMPLETE, ADR-0015). Dans le contexte « hr » : le compte qui a saisi est une simple colonne UUID.
-- Une valeur parmi trois par employé et par jour : aucune heure, aucun lieu, aucun retard, aucun texte libre (pas de surveillance du personnel).
CREATE TYPE "hr"."PresenceMode" AS ENUM ('ON_SITE', 'REMOTE', 'TRAVEL');

CREATE TABLE "hr"."presence_declarations" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "mode" "hr"."PresenceMode" NOT NULL,
  "declared_by_user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "presence_declarations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "hr"."presence_declarations" ADD CONSTRAINT "presence_declarations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Au plus une déclaration par employé et par jour, garanti par la base.
CREATE UNIQUE INDEX "presence_declarations_employee_id_day_key" ON "hr"."presence_declarations"("employee_id", "day");
CREATE INDEX "presence_declarations_day_idx" ON "hr"."presence_declarations"("day");
ALTER TABLE "hr"."presence_declarations" ADD CONSTRAINT "presence_declarations_version_positive" CHECK ("version" >= 1);
