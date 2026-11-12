-- S4.4b : ambassadeurs (clients ou apprenants devenus relais commerciaux), créés à la main.

-- CreateEnum
CREATE TYPE "bd"."AmbassadorOrigin" AS ENUM ('CLIENT', 'LEARNER');

-- CreateTable
CREATE TABLE "bd"."ambassadors" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "origin" "bd"."AmbassadorOrigin" NOT NULL,
    "company_id" UUID,
    "email" VARCHAR(200),
    "phone" VARCHAR(40),
    "appointed_on" DATE NOT NULL,
    "note" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ambassadors_owner_user_id_idx" ON "bd"."ambassadors"("owner_user_id");
CREATE INDEX "ambassadors_company_id_idx" ON "bd"."ambassadors"("company_id");

ALTER TABLE "bd"."ambassadors" ADD CONSTRAINT "ambassadors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bd"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un e-mail n'appartient qu'à UN ambassadeur, quoi que fasse l'application (deux créations simultanées : la seconde est refusée).
CREATE UNIQUE INDEX "ambassadors_email_unique" ON "bd"."ambassadors"("email") WHERE "email" IS NOT NULL;

-- Verrou optimiste : la version est toujours positive.
ALTER TABLE "bd"."ambassadors" ADD CONSTRAINT "ambassadors_version_positive" CHECK ("version" >= 1);
-- Un ambassadeur d'origine « client » est rattaché à son entreprise (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "bd"."ambassadors" ADD CONSTRAINT "ambassadors_client_has_company" CHECK (COALESCE("origin" <> 'CLIENT' OR "company_id" IS NOT NULL, false));
-- Le nom et le prénom ne sont jamais vides.
ALTER TABLE "bd"."ambassadors" ADD CONSTRAINT "ambassadors_names_not_blank" CHECK (COALESCE(length(btrim("last_name")) > 0 AND length(btrim("first_name")) > 0, false));
