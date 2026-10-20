-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "docs";
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "iam";
-- CreateEnum
CREATE TYPE "iam"."UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'DISABLED');
-- CreateEnum
CREATE TYPE "iam"."RoleScope" AS ENUM ('OWN', 'TEAM', 'ALL');
-- CreateEnum
CREATE TYPE "iam"."RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
-- CreateEnum
CREATE TYPE "iam"."OtpPurpose" AS ENUM ('RECOVERY', 'STEP_UP', 'EMAIL_VERIFICATION');
-- CreateEnum
CREATE TYPE "iam"."LoginOutcome" AS ENUM ('SUCCESS', 'BAD_CREDENTIALS', 'LOCKED', 'MFA_FAILED', 'RATE_LIMITED');
-- CreateEnum
CREATE TYPE "docs"."DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DELETED');
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "audit"."AuditAction" ADD VALUE 'LOGIN_FAILED';
ALTER TYPE "audit"."AuditAction" ADD VALUE 'ACCESS_DENIED';
ALTER TYPE "audit"."AuditAction" ADD VALUE 'PASSWORD_CHANGE';
ALTER TYPE "audit"."AuditAction" ADD VALUE 'MFA_CHANGE';
ALTER TYPE "audit"."AuditAction" ADD VALUE 'ROLE_CHANGE';
ALTER TYPE "audit"."AuditAction" ADD VALUE 'SESSION_REVOKE';
-- -----------------------------------------------------------------------------
-- AuditLog : conversion en table partitionnée par mois (copie des lignes existantes)
-- -----------------------------------------------------------------------------
CREATE TABLE "audit"."audit_logs_partitioned" (
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
    CONSTRAINT "audit_logs_pkey_new" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- Partition de secours : un journal ne doit jamais perdre une ligne faute de partition.
-- Toute ligne qui y atterrit doit déclencher une alerte (docs/SECURITY.md §10).
CREATE TABLE "audit"."audit_logs_default" PARTITION OF "audit"."audit_logs_partitioned" DEFAULT;

-- Crée les partitions mensuelles (UTC) du mois précédent jusqu'à N mois dans le futur.
-- À appeler périodiquement (planification en S7). Idempotent.
CREATE OR REPLACE FUNCTION "audit"."ensure_audit_partitions"(months_ahead integer DEFAULT 12)
RETURNS integer AS $$
DECLARE
  first_month date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date - interval '1 month';
  m date;
  created integer := 0;
  partition_name text;
BEGIN
  FOR i IN 0..(months_ahead + 1) LOOP
    m := (first_month + (i || ' month')::interval)::date;
    partition_name := format('audit_logs_%s', to_char(m, 'YYYY_MM'));
    IF to_regclass(format('audit.%I', partition_name)) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE audit.%I PARTITION OF audit.audit_logs_partitioned FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        (m::timestamp AT TIME ZONE 'UTC'),
        ((m + interval '1 month')::timestamp AT TIME ZONE 'UTC')
      );
      created := created + 1;
    END IF;
  END LOOP;
  RETURN created;
END;
$$ LANGUAGE plpgsql;

SELECT "audit"."ensure_audit_partitions"(12);

-- Copie des lignes existantes (vide hors environnements de développement), puis bascule.
INSERT INTO "audit"."audit_logs_partitioned"
  SELECT "id", "user_id", "session_id", "module", "entity_type", "entity_id", "action",
         "old_value", "new_value", "ip_address", "device", "created_at"
  FROM "audit"."audit_logs";

DROP TABLE "audit"."audit_logs";
ALTER TABLE "audit"."audit_logs_partitioned" RENAME TO "audit_logs";
ALTER TABLE "audit"."audit_logs" RENAME CONSTRAINT "audit_logs_pkey_new" TO "audit_logs_pkey";

CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit"."audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit"."audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_created_at_idx" ON "audit"."audit_logs"("created_at");

-- Append-only : refuse UPDATE, DELETE (par ligne) et TRUNCATE. La fonction date de la migration S1.
-- Retirer une partition entière (rétention) reste possible, par un administrateur de base uniquement.
CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit"."audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit"."forbid_audit_log_mutation"();
CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit"."audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit"."forbid_audit_log_mutation"();

-- CreateTable
CREATE TABLE "iam"."users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "email_key" VARCHAR(254) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "status" "iam"."UserStatus" NOT NULL DEFAULT 'PENDING',
    "password_hash" VARCHAR(255),
    "password_changed_at" TIMESTAMPTZ(6),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_enc" TEXT,
    "manager_id" UUID,
    "last_login_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "mfa_required" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope" "iam"."RoleScope" NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);
-- CreateTable
CREATE TABLE "iam"."user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);
-- CreateTable
CREATE TABLE "iam"."user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ip_address" VARCHAR(64) NOT NULL,
    "device" VARCHAR(300) NOT NULL,
    "browser" VARCHAR(100),
    "os" VARCHAR(100),
    "risk_level" "iam"."RiskLevel" NOT NULL DEFAULT 'LOW',
    "mfa_verified" BOOLEAN NOT NULL DEFAULT false,
    "logged_in_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "logged_out_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(200),
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."password_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."one_time_passwords" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "iam"."OtpPurpose" NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "one_time_passwords_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "iam"."login_attempts" (
    "id" UUID NOT NULL,
    "email_key" VARCHAR(254) NOT NULL,
    "user_id" UUID,
    "ip_address" VARCHAR(64) NOT NULL,
    "outcome" "iam"."LoginOutcome" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "docs"."documents" (
    "id" UUID NOT NULL,
    "owner_type" VARCHAR(50) NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "category" VARCHAR(100),
    "status" "docs"."DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version_number" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "docs"."document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "iam"."users"("manager_id");
-- CreateIndex
CREATE INDEX "users_status_idx" ON "iam"."users"("status");
-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "iam"."roles"("code");
-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "iam"."permissions"("code");
-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "iam"."permissions"("module");
-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "iam"."role_permissions"("permission_id");
-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "iam"."user_roles"("role_id");
-- CreateIndex
CREATE INDEX "user_sessions_user_id_logged_in_at_idx" ON "iam"."user_sessions"("user_id", "logged_in_at");
-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "iam"."user_sessions"("expires_at");
-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "iam"."refresh_tokens"("token_hash");
-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "iam"."refresh_tokens"("session_id");
-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "iam"."refresh_tokens"("family_id");
-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "iam"."refresh_tokens"("expires_at");
-- CreateIndex
CREATE INDEX "password_history_user_id_created_at_idx" ON "iam"."password_history"("user_id", "created_at" DESC);
-- CreateIndex
CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "iam"."mfa_recovery_codes"("user_id");
-- CreateIndex
CREATE INDEX "one_time_passwords_user_id_purpose_idx" ON "iam"."one_time_passwords"("user_id", "purpose");
-- CreateIndex
CREATE INDEX "one_time_passwords_expires_at_idx" ON "iam"."one_time_passwords"("expires_at");
-- CreateIndex
CREATE INDEX "login_attempts_email_key_created_at_idx" ON "iam"."login_attempts"("email_key", "created_at");
-- CreateIndex
CREATE INDEX "login_attempts_ip_address_created_at_idx" ON "iam"."login_attempts"("ip_address", "created_at");
-- CreateIndex
CREATE INDEX "documents_owner_type_owner_id_idx" ON "docs"."documents"("owner_type", "owner_id");
-- CreateIndex
CREATE INDEX "documents_status_idx" ON "docs"."documents"("status");
-- CreateIndex
CREATE UNIQUE INDEX "document_versions_storage_key_key" ON "docs"."document_versions"("storage_key");
-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "docs"."document_versions"("document_id", "version_number");
-- AddForeignKey
ALTER TABLE "iam"."users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "iam"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "iam"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "iam"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "iam"."user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "iam"."one_time_passwords" ADD CONSTRAINT "one_time_passwords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "docs"."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "docs"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Contraintes hors champ de Prisma
-- -----------------------------------------------------------------------------
-- Unicité de l'e-mail parmi les comptes non supprimés (soft delete)
CREATE UNIQUE INDEX "users_email_key_active_uq" ON "iam"."users"("email_key") WHERE "deleted_at" IS NULL;

ALTER TABLE "iam"."users" ADD CONSTRAINT "users_version_positive" CHECK ("version" >= 1);
ALTER TABLE "iam"."users" ADD CONSTRAINT "users_failed_login_count_nonneg" CHECK ("failed_login_count" >= 0);
ALTER TABLE "iam"."users" ADD CONSTRAINT "users_email_key_lowercase" CHECK ("email_key" = lower("email_key"));
-- Un utilisateur ne peut pas être son propre responsable
ALTER TABLE "iam"."users" ADD CONSTRAINT "users_not_own_manager" CHECK ("manager_id" IS NULL OR "manager_id" <> "id");

-- Une session expire après son dernier accès, et jamais après son expiration absolue
ALTER TABLE "iam"."user_sessions" ADD CONSTRAINT "user_sessions_expiry_order" CHECK ("expires_at" <= "absolute_expires_at");

ALTER TABLE "iam"."one_time_passwords" ADD CONSTRAINT "otp_attempts_nonneg" CHECK ("attempts" >= 0);

-- Documents : versions numérotées à partir de 1, empreinte SHA-256 hexadécimale, taille positive
ALTER TABLE "docs"."document_versions" ADD CONSTRAINT "document_versions_number_positive" CHECK ("version_number" >= 1);
ALTER TABLE "docs"."document_versions" ADD CONSTRAINT "document_versions_sha256_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "docs"."document_versions" ADD CONSTRAINT "document_versions_size_nonneg" CHECK ("size_bytes" >= 0);
ALTER TABLE "docs"."documents" ADD CONSTRAINT "documents_version_positive" CHECK ("version" >= 1);
