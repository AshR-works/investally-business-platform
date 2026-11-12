-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "bd";
-- CreateEnum
CREATE TYPE "bd"."CompanyStatus" AS ENUM ('TARGET', 'CONTACTED', 'QUALIFIED', 'CLIENT', 'ARCHIVED');
-- CreateEnum
CREATE TYPE "audit"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'DOWNLOAD', 'EXPORT', 'LOGIN', 'LOGOUT');
-- CreateTable
CREATE TABLE "bd"."companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_key" VARCHAR(200) NOT NULL,
    "status" "bd"."CompanyStatus" NOT NULL DEFAULT 'TARGET',
    "sector" VARCHAR(100),
    "country" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "audit"."audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "session_id" UUID,
    "module" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "action" "audit"."AuditAction" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(64) NOT NULL,
    "device" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "companies_status_idx" ON "bd"."companies"("status");
-- CreateIndex
-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit"."audit_logs"("entity_type", "entity_id");
-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit"."audit_logs"("user_id", "created_at");
-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit"."audit_logs"("created_at");

-- Unicité du nom parmi les entreprises non supprimées (soft delete)
CREATE UNIQUE INDEX "companies_name_key_active_uq" ON "bd"."companies"("name_key") WHERE "deleted_at" IS NULL;

-- Verrou optimiste : la version est toujours positive
ALTER TABLE "bd"."companies" ADD CONSTRAINT "companies_version_positive" CHECK ("version" >= 1);

-- AuditLog append-only : refuse UPDATE et DELETE, y compris pour le propriétaire de la table.
-- S2 ajoute en plus un rôle applicatif sans droit UPDATE/DELETE et le partitionnement mensuel.
CREATE OR REPLACE FUNCTION "audit"."forbid_audit_log_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_logs est en ajout seul (append-only)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit"."audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit"."forbid_audit_log_mutation"();
