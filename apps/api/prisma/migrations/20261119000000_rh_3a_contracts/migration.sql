-- RH-3a : contrats du personnel (D67, cadrage CADRAGE-RH-COMPLETE). Dans le contexte « hr » : aucune clé étrangère vers un autre schéma. AUCUN salaire, AUCUN document, AUCUNE
-- donnée sensible : un type, des dates, une période d'essai et un motif de fin choisi dans une liste fermée.
CREATE TYPE "hr"."ContractStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "hr"."ContractEndReason" AS ENUM ('FIXED_TERM_END', 'PROBATION_END', 'RESIGNATION', 'MISSION_END', 'OTHER');

-- Types de contrat : paramétrables par la RH, jamais supprimés (désactivés).
CREATE TABLE "hr"."contract_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "fixed_term" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "contract_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_types_code_key" ON "hr"."contract_types"("code");
ALTER TABLE "hr"."contract_types" ADD CONSTRAINT "contract_types_code_format" CHECK (COALESCE("code" ~ '^[A-Z][A-Z0-9_]{1,29}$', false));
ALTER TABLE "hr"."contract_types" ADD CONSTRAINT "contract_types_label_not_blank" CHECK (COALESCE(length(btrim("label")) > 0, false));
ALTER TABLE "hr"."contract_types" ADD CONSTRAINT "contract_types_sort_order_range" CHECK (COALESCE("sort_order" >= 0 AND "sort_order" <= 10000, false));
ALTER TABLE "hr"."contract_types" ADD CONSTRAINT "contract_types_version_positive" CHECK ("version" >= 1);

-- Contrats : plusieurs par employé au fil du temps, un seul en cours.
CREATE TABLE "hr"."contracts" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "contract_type_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "probation_end_date" DATE,
  "status" "hr"."ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "ended_on" DATE,
  "end_reason" "hr"."ContractEndReason",
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);
-- Références INTERNES au contexte « hr » : jamais de suppression d'un employé ou d'un type qui a des contrats.
ALTER TABLE "hr"."contracts" ADD CONSTRAINT "contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr"."contracts" ADD CONSTRAINT "contracts_contract_type_id_fkey" FOREIGN KEY ("contract_type_id") REFERENCES "hr"."contract_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "contracts_employee_id_start_date_idx" ON "hr"."contracts"("employee_id", "start_date");
CREATE INDEX "contracts_status_idx" ON "hr"."contracts"("status");
-- Un seul contrat en cours par employé, garanti par la base.
CREATE UNIQUE INDEX "contracts_one_active_per_employee" ON "hr"."contracts"("employee_id") WHERE "status" = 'ACTIVE';

ALTER TABLE "hr"."contracts" ADD CONSTRAINT "contracts_version_positive" CHECK ("version" >= 1);
ALTER TABLE "hr"."contracts" ADD CONSTRAINT "contracts_end_after_start" CHECK (COALESCE("end_date" IS NULL OR "end_date" >= "start_date", false));
ALTER TABLE "hr"."contracts" ADD CONSTRAINT "contracts_probation_within" CHECK (COALESCE("probation_end_date" IS NULL OR ("probation_end_date" >= "start_date" AND ("end_date" IS NULL OR "probation_end_date" <= "end_date")), false));
-- En cours = ni date ni motif de fin ; terminé = les deux, la date ne précède pas le début ni ne dépasse la fin prévue.
ALTER TABLE "hr"."contracts" ADD CONSTRAINT "contracts_status_consistent" CHECK (COALESCE(
  ("status" = 'ACTIVE' AND "ended_on" IS NULL AND "end_reason" IS NULL)
  OR ("status" = 'ENDED' AND "ended_on" IS NOT NULL AND "end_reason" IS NOT NULL AND "ended_on" >= "start_date" AND ("end_date" IS NULL OR "ended_on" <= "end_date")), false));

INSERT INTO "hr"."contract_types" ("id", "code", "label", "fixed_term", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'CDI', 'Contrat à durée indéterminée', false, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CDD', 'Contrat à durée déterminée', true, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'STAGE', 'Stage', true, 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PRESTATION', 'Prestation', true, 40, CURRENT_TIMESTAMP);
