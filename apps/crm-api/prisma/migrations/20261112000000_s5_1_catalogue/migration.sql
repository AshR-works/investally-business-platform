-- S5.1 : catalogue Investudy (programmes, certificats, modules partagés, salles, formateurs). Nouveau contexte « training » : aucune clé étrangère vers un autre
-- contexte (le compte lié d'un formateur est une simple colonne UUID).
CREATE SCHEMA IF NOT EXISTS "training";

CREATE TYPE "training"."CatalogueStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "training"."RoomKind" AS ENUM ('WORKSTATIONS', 'CLASSROOM');

CREATE TABLE "training"."programs" (
  "id" UUID NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "name_key" VARCHAR(150) NOT NULL,
  "description" VARCHAR(2000),
  "audience" VARCHAR(500),
  "status" "training"."CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training"."trainings" (
  "id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "title_key" VARCHAR(150) NOT NULL,
  "objectives" VARCHAR(2000),
  "prerequisites" VARCHAR(1000),
  "price_amount" DECIMAL(12,2),
  "module_price_amount" DECIMAL(12,2),
  "price_currency" CHAR(3),
  "status" "training"."CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training"."modules" (
  "id" UUID NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "title_key" VARCHAR(150) NOT NULL,
  "description" VARCHAR(1000),
  "requires_workstations" BOOLEAN NOT NULL DEFAULT false,
  "status" "training"."CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training"."training_modules" (
  "training_id" UUID NOT NULL,
  "module_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "training_modules_pkey" PRIMARY KEY ("training_id", "module_id")
);

CREATE TABLE "training"."rooms" (
  "id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "name_key" VARCHAR(100) NOT NULL,
  "kind" "training"."RoomKind" NOT NULL DEFAULT 'WORKSTATIONS',
  "learner_seats" INTEGER NOT NULL,
  "unavailable_seats" INTEGER NOT NULL DEFAULT 0,
  "trainer_seats" INTEGER NOT NULL DEFAULT 1,
  "equipment" VARCHAR(1000),
  "status" "training"."CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training"."trainers" (
  "id" UUID NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "specialties" VARCHAR(500),
  "email" VARCHAR(200),
  "email_key" VARCHAR(200),
  "phone" VARCHAR(40),
  "user_id" UUID,
  "status" "training"."CatalogueStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "programs_name_key_key" ON "training"."programs"("name_key");
CREATE UNIQUE INDEX "trainings_program_id_title_key_key" ON "training"."trainings"("program_id", "title_key");
CREATE UNIQUE INDEX "modules_title_key_key" ON "training"."modules"("title_key");
CREATE UNIQUE INDEX "training_modules_training_id_position_key" ON "training"."training_modules"("training_id", "position");
CREATE INDEX "training_modules_module_id_idx" ON "training"."training_modules"("module_id");
CREATE UNIQUE INDEX "rooms_name_key_key" ON "training"."rooms"("name_key");
CREATE UNIQUE INDEX "trainers_email_key_key" ON "training"."trainers"("email_key");
CREATE UNIQUE INDEX "trainers_user_id_key" ON "training"."trainers"("user_id");

ALTER TABLE "training"."trainings" ADD CONSTRAINT "trainings_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training"."programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training"."training_modules" ADD CONSTRAINT "training_modules_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "training"."trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training"."training_modules" ADD CONSTRAINT "training_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "training"."modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Règles garanties par la base (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "training"."programs" ADD CONSTRAINT "programs_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."trainings" ADD CONSTRAINT "trainings_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."rooms" ADD CONSTRAINT "rooms_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."trainers" ADD CONSTRAINT "trainers_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."modules" ADD CONSTRAINT "modules_version_positive" CHECK ("version" >= 1);
ALTER TABLE "training"."training_modules" ADD CONSTRAINT "training_modules_position_positive" CHECK (COALESCE("position" >= 1, false));
-- La devise est présente exactement quand l'un des deux prix (complet, par module) l'est ; chaque prix est positif.
ALTER TABLE "training"."trainings" ADD CONSTRAINT "trainings_price_coherent" CHECK (COALESCE((("price_amount" IS NULL AND "module_price_amount" IS NULL) = ("price_currency" IS NULL)) AND ("price_amount" IS NULL OR "price_amount" > 0) AND ("module_price_amount" IS NULL OR "module_price_amount" > 0), false));
ALTER TABLE "training"."rooms" ADD CONSTRAINT "rooms_seats_range" CHECK (COALESCE("learner_seats" BETWEEN 1 AND 1000 AND "unavailable_seats" BETWEEN 0 AND "learner_seats" AND "trainer_seats" BETWEEN 0 AND 10, false));
ALTER TABLE "training"."trainers" ADD CONSTRAINT "trainers_phone_format" CHECK (COALESCE("phone" IS NULL OR "phone" ~ '^\+?[1-9][0-9]{7,14}$', false));
ALTER TABLE "training"."trainers" ADD CONSTRAINT "trainers_email_key_coherent" CHECK (COALESCE(("email" IS NULL) = ("email_key" IS NULL), false));
