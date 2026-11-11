-- RH-3b : parcours d'intégration et de départ (D67, cadrage CADRAGE-RH-COMPLETE). Dans le contexte « hr » : aucune clé étrangère vers un autre schéma (les comptes qui
-- lancent ou cochent sont de simples colonnes UUID). Aucune donnée sensible : des tâches (titre court, responsable dans une liste fermée, échéance relative).
CREATE TYPE "hr"."JourneyKind" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "hr"."JourneyStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "hr"."JourneyTaskOwner" AS ENUM ('HR', 'MANAGER', 'EMPLOYEE', 'IT');

-- Modèles : UN par nature (intégration, départ), modifiables par la RH.
CREATE TABLE "hr"."journey_templates" (
  "id" UUID NOT NULL,
  "kind" "hr"."JourneyKind" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "journey_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "journey_templates_kind_key" ON "hr"."journey_templates"("kind");
ALTER TABLE "hr"."journey_templates" ADD CONSTRAINT "journey_templates_version_positive" CHECK ("version" >= 1);

CREATE TABLE "hr"."journey_template_tasks" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "owner" "hr"."JourneyTaskOwner" NOT NULL,
  "due_offset_days" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "journey_template_tasks_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "hr"."journey_template_tasks" ADD CONSTRAINT "journey_template_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hr"."journey_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "journey_template_tasks_template_id_sort_order_idx" ON "hr"."journey_template_tasks"("template_id", "sort_order");
ALTER TABLE "hr"."journey_template_tasks" ADD CONSTRAINT "journey_template_tasks_title_not_blank" CHECK (COALESCE(length(btrim("title")) > 0, false));
ALTER TABLE "hr"."journey_template_tasks" ADD CONSTRAINT "journey_template_tasks_offset_range" CHECK (COALESCE("due_offset_days" >= -365 AND "due_offset_days" <= 365, false));

-- Parcours lancés pour un employé : plusieurs au fil du temps, un seul en cours par nature.
CREATE TABLE "hr"."journeys" (
  "id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "kind" "hr"."JourneyKind" NOT NULL,
  "reference_date" DATE NOT NULL,
  "status" "hr"."JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
  "launched_by_user_id" UUID NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "hr"."journeys" ADD CONSTRAINT "journeys_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "journeys_employee_id_kind_idx" ON "hr"."journeys"("employee_id", "kind");
CREATE INDEX "journeys_status_idx" ON "hr"."journeys"("status");
-- Un seul parcours en cours par employé et par nature, garanti par la base.
CREATE UNIQUE INDEX "journeys_one_active_per_employee_kind" ON "hr"."journeys"("employee_id", "kind") WHERE "status" = 'ACTIVE';
ALTER TABLE "hr"."journeys" ADD CONSTRAINT "journeys_version_positive" CHECK ("version" >= 1);
-- Cohérence de l'état : en cours = ni terminé ni annulé ; terminé = date de fin seule ; annulé = date d'annulation seule.
ALTER TABLE "hr"."journeys" ADD CONSTRAINT "journeys_status_consistent" CHECK (COALESCE(
  ("status" = 'ACTIVE' AND "completed_at" IS NULL AND "cancelled_at" IS NULL)
  OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "cancelled_at" IS NULL)
  OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "completed_at" IS NULL), false));

-- Tâches d'un parcours : copie figée du modèle au lancement (modifier le modèle ne change pas les parcours en cours).
CREATE TABLE "hr"."journey_tasks" (
  "id" UUID NOT NULL,
  "journey_id" UUID NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "owner" "hr"."JourneyTaskOwner" NOT NULL,
  "due_on" DATE NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "done_at" TIMESTAMPTZ(6),
  "done_by_user_id" UUID,
  CONSTRAINT "journey_tasks_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "hr"."journey_tasks" ADD CONSTRAINT "journey_tasks_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "hr"."journeys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "journey_tasks_journey_id_sort_order_idx" ON "hr"."journey_tasks"("journey_id", "sort_order");
ALTER TABLE "hr"."journey_tasks" ADD CONSTRAINT "journey_tasks_title_not_blank" CHECK (COALESCE(length(btrim("title")) > 0, false));
-- Une tâche cochée porte la date ET l'auteur ; une tâche non cochée, aucun des deux.
ALTER TABLE "hr"."journey_tasks" ADD CONSTRAINT "journey_tasks_done_consistent" CHECK (("done_at" IS NULL) = ("done_by_user_id" IS NULL));

-- Modèles de départ (valeurs « à confirmer » avec la RH). Échéance : jours par rapport à la date de référence (entrée ou départ), négatif = avant.
INSERT INTO "hr"."journey_templates" ("id", "kind", "updated_at") VALUES
  ('00000000-0000-4000-8000-0000000b0001', 'ONBOARDING', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000b0002', 'OFFBOARDING', CURRENT_TIMESTAMP);
INSERT INTO "hr"."journey_template_tasks" ("id", "template_id", "title", "owner", "due_offset_days", "sort_order") VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0001', 'Préparer le poste de travail et les accès', 'IT', -3, 10),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0001', 'Accueillir et présenter l’équipe', 'MANAGER', 0, 20),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0001', 'Remettre le règlement intérieur', 'HR', 0, 30),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0001', 'Vérifier la fiche de l’employé', 'HR', 2, 40),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0001', 'Point de fin de première semaine', 'MANAGER', 7, 50),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0001', 'Bilan de fin de période d’essai', 'HR', 30, 60),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0002', 'Transférer les dossiers en cours', 'MANAGER', -7, 10),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0002', 'Entretien de départ', 'HR', -3, 20),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0002', 'Récupérer le matériel', 'IT', 0, 30),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0002', 'Désactiver les comptes et les accès', 'IT', 0, 40),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000b0002', 'Archiver la fiche de l’employé', 'HR', 1, 50);
