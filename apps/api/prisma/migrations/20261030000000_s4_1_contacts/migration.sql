-- S4.1 : contacts (interlocuteurs) des entreprises.

-- CreateEnum
CREATE TYPE "bd"."ContactRole" AS ENUM ('FINANCE_DIRECTOR', 'DECISION_MAKER', 'OTHER');

-- CreateTable
CREATE TABLE "bd"."contacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "name_key" VARCHAR(210) NOT NULL,
    "role" "bd"."ContactRole" NOT NULL DEFAULT 'OTHER',
    "email" VARCHAR(200),
    "email_key" VARCHAR(200),
    "phone" VARCHAR(40),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- Un contact appartient à une entreprise du même contexte (clé étrangère autorisée à l'intérieur d'un contexte).
ALTER TABLE "bd"."contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Détection de doublons : même entreprise, même nom ou même e-mail (non unique : un doublon probable est signalé, pas interdit).
CREATE INDEX "contacts_company_id_idx" ON "bd"."contacts"("company_id");
CREATE INDEX "contacts_company_id_name_key_idx" ON "bd"."contacts"("company_id", "name_key");
CREATE INDEX "contacts_company_id_email_key_idx" ON "bd"."contacts"("company_id", "email_key");

-- Verrou optimiste : la version est toujours positive.
ALTER TABLE "bd"."contacts" ADD CONSTRAINT "contacts_version_positive" CHECK ("version" >= 1);
