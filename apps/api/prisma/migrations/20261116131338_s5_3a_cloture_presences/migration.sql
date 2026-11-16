-- CreateEnum
CREATE TYPE "training"."AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateTable
CREATE TABLE "training"."attendances" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "status" "training"."AttendanceStatus" NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendances_day_idx" ON "training"."attendances"("day");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_enrollment_id_day_key" ON "training"."attendances"("enrollment_id", "day");

-- AddForeignKey
ALTER TABLE "training"."attendances" ADD CONSTRAINT "attendances_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training"."enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
