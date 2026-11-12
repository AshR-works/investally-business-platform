-- Réinitialisation de mot de passe par un administrateur : même mécanisme que l'invitation (lien à usage unique,
-- seule l'empreinte du jeton est stockée), mais pour un compte ACTIF. Le champ `purpose` empêche d'utiliser un lien
-- pour autre chose que ce pour quoi il a été émis. Les invitations existantes restent des INVITATION.
ALTER TABLE "iam"."user_invitations" ADD COLUMN "purpose" VARCHAR(20) NOT NULL DEFAULT 'INVITATION';
ALTER TABLE "iam"."user_invitations" ADD CONSTRAINT "user_invitations_purpose_known" CHECK ("purpose" IN ('INVITATION', 'PASSWORD_RESET'));

-- Journal d'audit : demande, émission et usage d'un lien de réinitialisation ont leur propre action (recherche facile).
ALTER TYPE "audit"."AuditAction" ADD VALUE 'PASSWORD_RESET';
