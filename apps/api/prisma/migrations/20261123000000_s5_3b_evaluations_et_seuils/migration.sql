-- CreateTable
CREATE TABLE "training"."evaluations" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "score" DECIMAL(4,2) NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_enrollment_id_key" ON "training"."evaluations"("enrollment_id");

ALTER TABLE "training"."evaluations" ADD CONSTRAINT "evaluations_score_range" CHECK (COALESCE("score" >= 0 AND "score" <= 20, false));

-- AddForeignKey
ALTER TABLE "training"."evaluations" ADD CONSTRAINT "evaluations_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seuils d'éligibilité : UNE seule ligne, valeurs de départ « à confirmer » (D31, S5).
CREATE TABLE "training"."training_thresholds" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "attendance_threshold_percent" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "score_threshold" DECIMAL(4,2) NOT NULL DEFAULT 10,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_thresholds_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "training"."training_thresholds" ADD CONSTRAINT "training_thresholds_single_row" CHECK ("id" = 1);
ALTER TABLE "training"."training_thresholds" ADD CONSTRAINT "training_thresholds_attendance_range" CHECK (COALESCE("attendance_threshold_percent" >= 0 AND "attendance_threshold_percent" <= 100, false));
ALTER TABLE "training"."training_thresholds" ADD CONSTRAINT "training_thresholds_score_range" CHECK (COALESCE("score_threshold" >= 0 AND "score_threshold" <= 20, false));
ALTER TABLE "training"."training_thresholds" ADD CONSTRAINT "training_thresholds_version_positive" CHECK ("version" >= 1);

INSERT INTO "training"."training_thresholds" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);
