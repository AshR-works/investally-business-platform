-- RH-2a : absences et congés (RH légère, D64, cadrage CADRAGE-RH-COMPLETE). Dans le contexte « hr » : AUCUNE clé étrangère vers un autre schéma (les comptes qui
-- saisissent ou décident sont de simples colonnes UUID). Aucune donnée de santé : un type « maladie » ne porte jamais de diagnostic ni de pièce.
CREATE TYPE "hr"."LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- Types d'absence : paramétrables par la RH, jamais supprimés (désactivés).
CREATE TABLE "hr"."leave_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "deducts_balance" BOOLEAN NOT NULL DEFAULT false,
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "max_days_per_request" DECIMAL(5,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_types_code_key" ON "hr"."leave_types"("code");
ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_code_format" CHECK (COALESCE("code" ~ '^[A-Z][A-Z0-9_]{1,29}$', false));
ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_label_not_blank" CHECK (COALESCE(length(btrim("label")) > 0, false));
ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_max_days_positive" CHECK (COALESCE("max_days_per_request" IS NULL OR ("max_days_per_request" > 0 AND "max_days_per_request" * 2 = round("max_days_per_request" * 2)), false));
ALTER TABLE "hr"."leave_types" ADD CONSTRAINT "leave_types_version_positive" CHECK ("version" >= 1);

-- Jours fériés : saisis par la RH, liste vide au départ (aucune liste légale n'est présumée).
CREATE TABLE "hr"."public_holidays" (
  "id" UUID NOT NULL,
  "day" DATE NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "public_holidays_day_key" ON "hr"."public_holidays"("day");
ALTER TABLE "hr"."public_holidays" ADD CONSTRAINT "public_holidays_label_not_blank" CHECK (COALESCE(length(btrim("label")) > 0, false));

-- Règles de congés : UNE seule ligne, valeurs de départ « à confirmer ».
CREATE TABLE "hr"."leave_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "accrual_days_per_month" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
  "counts_saturday" BOOLEAN NOT NULL DEFAULT false,
  "allow_half_days" BOOLEAN NOT NULL DEFAULT true,
  "allow_negative_balance" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "hr"."leave_settings" ADD CONSTRAINT "leave_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "hr"."leave_settings" ADD CONSTRAINT "leave_settings_accrual_range" CHECK (COALESCE("accrual_days_per_month" >= 0 AND "accrual_days_per_month" <= 5, false));
ALTER TABLE "hr"."leave_settings" ADD CONSTRAINT "leave_settings_version_positive" CHECK ("version" >= 1);

-- Demandes d'absence.
CREATE TABLE "hr"."leave_requests" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "start_half" BOOLEAN NOT NULL DEFAULT false,
  "end_half" BOOLEAN NOT NULL DEFAULT false,
  "days" DECIMAL(5,2) NOT NULL,
  "leave_year" INTEGER NOT NULL,
  "status" "hr"."LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "note" VARCHAR(500),
  "requested_by_user_id" UUID NOT NULL,
  "decided_by_user_id" UUID,
  "decided_at" TIMESTAMPTZ(6),
  "decision_note" VARCHAR(500),
  "cancelled_at" TIMESTAMPTZ(6),
  "cancel_reason" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);
-- Références INTERNES au contexte « hr » : jamais de suppression d'un employé ou d'un type qui a des demandes.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "hr"."leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "leave_requests_employee_id_start_date_idx" ON "hr"."leave_requests"("employee_id", "start_date");
CREATE INDEX "leave_requests_status_idx" ON "hr"."leave_requests"("status");
CREATE INDEX "leave_requests_leave_year_idx" ON "hr"."leave_requests"("leave_year");

-- Règles garanties par la base, quoi que fasse l'application (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_version_positive" CHECK ("version" >= 1);
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_dates_ordered" CHECK (COALESCE("end_date" >= "start_date", false));
-- Les jours : positifs, par demi-journée, jamais plus que le nombre de jours calendaires de la période.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_days_valid" CHECK (COALESCE("days" > 0 AND "days" * 2 = round("days" * 2) AND "days" <= ("end_date" - "start_date" + 1), false));
-- Une seule journée ne commence pas l'après-midi ET ne s'arrête pas à midi.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_single_day_halves" CHECK (COALESCE(NOT ("start_date" = "end_date" AND "start_half" AND "end_half"), false));
-- L'année de congé est celle de la date de début.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_year_matches_start" CHECK (COALESCE("leave_year" = EXTRACT(YEAR FROM "start_date")::int, false));
-- Cohérence de l'état : en attente = rien de décidé ni d'annulé ; validée = décidée, non annulée ; refusée = décidée avec un motif ; annulée = date d'annulation.
ALTER TABLE "hr"."leave_requests" ADD CONSTRAINT "leave_requests_status_consistent" CHECK (COALESCE(
  ("status" = 'PENDING' AND "decided_at" IS NULL AND "decided_by_user_id" IS NULL AND "decision_note" IS NULL AND "cancelled_at" IS NULL AND "cancel_reason" IS NULL)
  OR ("status" = 'APPROVED' AND "decided_at" IS NOT NULL AND "cancelled_at" IS NULL AND "cancel_reason" IS NULL)
  OR ("status" = 'REJECTED' AND "decided_at" IS NOT NULL AND "decision_note" IS NOT NULL AND length(btrim("decision_note")) > 0 AND "cancelled_at" IS NULL)
  OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL), false));

-- Ajustements de solde : ajout seul, motif obligatoire.
CREATE TABLE "hr"."leave_adjustments" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "days" DECIMAL(5,2) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_adjustments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "hr"."leave_adjustments" ADD CONSTRAINT "leave_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "leave_adjustments_employee_id_year_idx" ON "hr"."leave_adjustments"("employee_id", "year");
ALTER TABLE "hr"."leave_adjustments" ADD CONSTRAINT "leave_adjustments_days_valid" CHECK (COALESCE("days" <> 0 AND abs("days") <= 60 AND "days" * 2 = round("days" * 2), false));
ALTER TABLE "hr"."leave_adjustments" ADD CONSTRAINT "leave_adjustments_reason_not_blank" CHECK (COALESCE(length(btrim("reason")) > 0, false));
ALTER TABLE "hr"."leave_adjustments" ADD CONSTRAINT "leave_adjustments_year_range" CHECK ("year" BETWEEN 2000 AND 2100);

-- Données de référence : règles de départ (« à confirmer », modifiables par la RH) et types d'absence usuels. Aucun jour férié : la RH saisit la liste applicable.
INSERT INTO "hr"."leave_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);
INSERT INTO "hr"."leave_types" ("id", "code", "label", "deducts_balance", "requires_approval", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'ANNUAL', 'Congé annuel', true, true, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SICK', 'Maladie', false, true, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SPECIAL', 'Permission exceptionnelle', false, true, 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UNPAID', 'Sans solde', false, true, 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PARENTAL', 'Maternité et paternité', false, true, 50, CURRENT_TIMESTAMP);
