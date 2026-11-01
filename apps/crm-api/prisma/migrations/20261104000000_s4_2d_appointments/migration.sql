-- S4.2d : rendez-vous et visites (agenda).

-- CreateEnum
CREATE TYPE "bd"."AppointmentType" AS ENUM ('FINANCE_DIRECTOR', 'DECISION_MAKER', 'VISIT');
CREATE TYPE "bd"."AppointmentStatus" AS ENUM ('PLANNED', 'HELD', 'CANCELLED');

-- CreateTable
CREATE TABLE "bd"."appointments" (
    "id" UUID NOT NULL,
    "type" "bd"."AppointmentType" NOT NULL,
    "company_id" UUID NOT NULL,
    "contact_id" UUID,
    "offer_id" UUID,
    "organizer_user_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "location" VARCHAR(200),
    "note" VARCHAR(500),
    "status" "bd"."AppointmentStatus" NOT NULL DEFAULT 'PLANNED',
    "outcome_note" VARCHAR(1000),
    "closed_at" TIMESTAMPTZ(6),
    "postponements" INTEGER NOT NULL DEFAULT 0,
    "last_postpone_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointments_company_id_idx" ON "bd"."appointments"("company_id");
CREATE INDEX "appointments_starts_at_idx" ON "bd"."appointments"("starts_at");
-- Le contrôle des conflits parcourt les rendez-vous à venir d'un organisateur.
CREATE INDEX "appointments_planned_organizer_idx" ON "bd"."appointments"("organizer_user_id", "starts_at") WHERE "status" = 'PLANNED';

ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "bd"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "bd"."offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verrou optimiste et compteur de reports.
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_version_positive" CHECK ("version" >= 1);
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_postponements_positive" CHECK ("postponements" >= 0);
-- Durée d'un rendez-vous : de 15 minutes à 8 heures.
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_duration_range" CHECK (COALESCE("duration_minutes" BETWEEN 15 AND 480, false));
-- Un rendez-vous à venir n'est pas clos ; un rendez-vous tenu ou annulé a sa date de clôture ET son compte rendu ou son motif
-- (COALESCE : un résultat inconnu ne doit pas passer pour vrai).
ALTER TABLE "bd"."appointments" ADD CONSTRAINT "appointments_closure_coherent" CHECK (
  COALESCE(
    ("status" = 'PLANNED') = ("closed_at" IS NULL) AND ("status" = 'PLANNED') = ("outcome_note" IS NULL),
    false
  )
);
