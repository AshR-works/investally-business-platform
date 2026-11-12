-- S4.0 : coordonnées de l'entreprise, facilitateurs réutilisables et lien entreprise ↔ facilitateur (méthode de contact, commission).

-- CreateEnum
CREATE TYPE "bd"."ContactMethod" AS ENUM ('WHATSAPP_MESSAGE', 'PHONE_CALL', 'EMAIL', 'MEETING', 'OTHER');
-- CreateEnum
CREATE TYPE "bd"."CommissionType" AS ENUM ('FIXED', 'PERCENT');

-- AlterTable : coordonnées de l'entreprise
ALTER TABLE "bd"."companies" ADD COLUMN "email" VARCHAR(200), ADD COLUMN "phone" VARCHAR(40);

-- CreateTable : le facilitateur (personne physique, réutilisable d'une entreprise à l'autre)
CREATE TABLE "bd"."facilitators" (
    "id" UUID NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "comment" VARCHAR(2000),
    "owner_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "facilitators_pkey" PRIMARY KEY ("id")
);

-- CreateTable : le lien porte la méthode de contact, l'appartenance à l'entreprise et la commission
CREATE TABLE "bd"."company_facilitations" (
    "company_id" UUID NOT NULL,
    "facilitator_id" UUID NOT NULL,
    "contact_method" "bd"."ContactMethod" NOT NULL,
    "is_company_employee" BOOLEAN NOT NULL DEFAULT false,
    "commission_type" "bd"."CommissionType",
    "commission_value" DECIMAL(12,2),
    "commission_currency" CHAR(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_facilitations_pkey" PRIMARY KEY ("company_id")
);

CREATE INDEX "facilitators_owner_user_id_idx" ON "bd"."facilitators"("owner_user_id");
CREATE INDEX "company_facilitations_facilitator_id_idx" ON "bd"."company_facilitations"("facilitator_id");

ALTER TABLE "bd"."company_facilitations" ADD CONSTRAINT "company_facilitations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd"."company_facilitations" ADD CONSTRAINT "company_facilitations_facilitator_id_fkey"
  FOREIGN KEY ("facilitator_id") REFERENCES "bd"."facilitators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bd"."facilitators" ADD CONSTRAINT "facilitators_version_positive" CHECK ("version" >= 1);

-- Commission : toutes ses colonnes ou aucune ; pourcentage entre 0 et 100 ; montant fixe positif avec devise.
-- COALESCE(..., false) : un CHECK accepte le résultat « inconnu » (NULL), donc une colonne manquante passerait sinon.
ALTER TABLE "bd"."company_facilitations" ADD CONSTRAINT "company_facilitations_commission_coherent" CHECK (COALESCE(
  ("commission_type" IS NULL AND "commission_value" IS NULL AND "commission_currency" IS NULL)
  OR ("commission_type" = 'PERCENT' AND "commission_value" > 0 AND "commission_value" <= 100 AND "commission_currency" IS NULL)
  OR ("commission_type" = 'FIXED' AND "commission_value" > 0 AND "commission_currency" ~ '^[A-Z]{3}$'),
  false));
