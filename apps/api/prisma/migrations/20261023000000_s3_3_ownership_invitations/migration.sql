-- S3.3 : propriété des entreprises (portée Propre/Équipe) et invitations de comptes

-- Propriétaire d'une entreprise : détermine la portée des droits (Propre, Équipe, Tous).
-- Référence inter-contextes (bd -> iam) SANS clé étrangère : cohérence assurée par l'application.
-- Les entreprises créées avant S3.3 n'ont pas de propriétaire : seuls les rôles en portée Tous les voient.
ALTER TABLE "bd"."companies" ADD COLUMN "owner_user_id" UUID;
CREATE INDEX "companies_owner_user_id_idx" ON "bd"."companies"("owner_user_id");

-- Invitations : le compte est créé sans mot de passe ; l'utilisateur le choisit via un lien à usage unique.
-- Seule l'empreinte SHA-256 du jeton est stockée.
CREATE TABLE "iam"."user_invitations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "iam"."user_invitations"("token_hash");
CREATE INDEX "user_invitations_user_id_idx" ON "iam"."user_invitations"("user_id");
CREATE INDEX "user_invitations_expires_at_idx" ON "iam"."user_invitations"("expires_at");

ALTER TABLE "iam"."user_invitations" ADD CONSTRAINT "user_invitations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "iam"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une invitation expire toujours après sa création ; le jeton est un SHA-256 hexadécimal.
ALTER TABLE "iam"."user_invitations" ADD CONSTRAINT "user_invitations_expiry_after_creation" CHECK ("expires_at" > "created_at");
ALTER TABLE "iam"."user_invitations" ADD CONSTRAINT "user_invitations_token_hash_hex" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
