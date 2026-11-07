-- S5.2a : sessions de formation (un certificat, un rythme, une salle, un formateur, des dates, une capacité).
CREATE TYPE "training"."SessionStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "training"."SessionRhythm" AS ENUM ('DAY', 'EVENING');

CREATE TABLE "training"."sessions" (
  "id" UUID NOT NULL,
  "training_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "trainer_id" UUID NOT NULL,
  "rhythm" "training"."SessionRhythm" NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "training"."SessionStatus" NOT NULL DEFAULT 'PLANNED',
  "cancel_reason" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessions_room_id_start_date_end_date_idx" ON "training"."sessions"("room_id", "start_date", "end_date");
CREATE INDEX "sessions_trainer_id_start_date_end_date_idx" ON "training"."sessions"("trainer_id", "start_date", "end_date");
CREATE INDEX "sessions_training_id_idx" ON "training"."sessions"("training_id");
CREATE INDEX "sessions_status_start_date_idx" ON "training"."sessions"("status", "start_date");

ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training"."trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "training"."rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "training"."trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Règles garanties par la base (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_capacity_range" CHECK (COALESCE("capacity" BETWEEN 1 AND 1000, false));
ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_dates_ordered" CHECK (COALESCE("end_date" >= "start_date", false));
-- Le motif d'annulation est présent exactement quand la session est annulée.
ALTER TABLE "training"."sessions" ADD CONSTRAINT "sessions_cancel_reason_coherent" CHECK (COALESCE(("status" = 'CANCELLED') = ("cancel_reason" IS NOT NULL), false));
