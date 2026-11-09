-- RH-1a : annuaire du personnel (RH légère, ADR-0009, D55 à D58). Nouveau contexte « hr » : AUCUNE clé étrangère vers un autre schéma (le compte lié est une
-- simple colonne UUID). Identité PROFESSIONNELLE seulement : jamais de salaire, pièce d'identité, adresse personnelle ni date de naissance (D57).
CREATE SCHEMA IF NOT EXISTS "hr";

CREATE TYPE "hr"."EmployeeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "hr"."employees" (
  "id" UUID NOT NULL,
  "matricule" VARCHAR(30),
  "last_name" VARCHAR(100) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "job_title" VARCHAR(150) NOT NULL,
  "department" VARCHAR(100) NOT NULL,
  "manager_employee_id" UUID,
  "user_id" UUID,
  "work_email" VARCHAR(200),
  "work_phone" VARCHAR(40),
  "hired_on" DATE NOT NULL,
  "left_on" DATE,
  "status" "hr"."EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(6),
  "archive_reason" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- Hiérarchie interne au contexte « hr » : jamais de suppression physique d'un responsable qui a des collaborateurs.
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "employees_manager_employee_id_idx" ON "hr"."employees"("manager_employee_id");
CREATE INDEX "employees_status_idx" ON "hr"."employees"("status");
CREATE INDEX "employees_department_idx" ON "hr"."employees"("department");

-- Unicité garantie par la base, quoi que fasse l'application : un matricule, un e-mail professionnel et un compte n'appartiennent qu'à UN employé.
CREATE UNIQUE INDEX "employees_matricule_unique" ON "hr"."employees"(upper("matricule")) WHERE "matricule" IS NOT NULL;
CREATE UNIQUE INDEX "employees_work_email_unique" ON "hr"."employees"(lower("work_email")) WHERE "work_email" IS NOT NULL;
CREATE UNIQUE INDEX "employees_user_id_unique" ON "hr"."employees"("user_id") WHERE "user_id" IS NOT NULL;

-- Règles de la base (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_version_positive" CHECK ("version" >= 1);
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_names_not_blank" CHECK (COALESCE(length(btrim("last_name")) > 0 AND length(btrim("first_name")) > 0 AND length(btrim("job_title")) > 0 AND length(btrim("department")) > 0, false));
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_not_own_manager" CHECK (COALESCE("manager_employee_id" IS NULL OR "manager_employee_id" <> "id", false));
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_left_after_hired" CHECK (COALESCE("left_on" IS NULL OR "left_on" >= "hired_on", false));
-- Archivé : une date d'archivage ; actif : ni date d'archivage, ni motif, ni date de sortie.
ALTER TABLE "hr"."employees" ADD CONSTRAINT "employees_status_consistent" CHECK (COALESCE(
  ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL) OR ("status" = 'ACTIVE' AND "archived_at" IS NULL AND "archive_reason" IS NULL AND "left_on" IS NULL), false));
