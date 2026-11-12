-- S3.2 : MFA TOTP
-- Dernier pas de temps TOTP accepté : un code ne peut servir qu'une fois (anti-rejeu, RFC 6238 §5.2).
ALTER TABLE "iam"."users" ADD COLUMN "mfa_last_used_step" BIGINT;

-- Horodatage de la dernière vérification MFA de la session : sert au step-up (MFA récent < 10 min).
ALTER TABLE "iam"."user_sessions" ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(6);

-- Un MFA activé a forcément un secret ; un pas de temps n'est jamais négatif.
ALTER TABLE "iam"."users" ADD CONSTRAINT "users_mfa_enabled_has_secret" CHECK (NOT "mfa_enabled" OR "mfa_secret_enc" IS NOT NULL);
ALTER TABLE "iam"."users" ADD CONSTRAINT "users_mfa_step_nonneg" CHECK ("mfa_last_used_step" IS NULL OR "mfa_last_used_step" >= 0);
