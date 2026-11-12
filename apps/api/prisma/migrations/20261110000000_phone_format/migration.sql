-- Observation de recette 1 : les numéros de téléphone suivent une règle unique (chiffres et « + » en tête seulement, premier chiffre non nul,
-- 8 à 15 chiffres, enregistrés sans espace). Cette migration nettoie la forme des numéros existants, puis garantit la règle en base.

-- 1. Nettoyage de la forme : on ne retire que les séparateurs (espaces, tirets, points, parenthèses). Une valeur n'est remplacée que si le
--    résultat respecte la règle ; sinon elle est laissée telle quelle (jamais effacée) : elle se corrige à la main, voir « 3 ».
UPDATE "bd"."companies" SET "phone" = regexp_replace("phone", '[\s().-]', '', 'g')
  WHERE "phone" IS NOT NULL AND "phone" !~ '^\+?[1-9][0-9]{7,14}$' AND regexp_replace("phone", '[\s().-]', '', 'g') ~ '^\+?[1-9][0-9]{7,14}$';
UPDATE "bd"."contacts" SET "phone" = regexp_replace("phone", '[\s().-]', '', 'g')
  WHERE "phone" IS NOT NULL AND "phone" !~ '^\+?[1-9][0-9]{7,14}$' AND regexp_replace("phone", '[\s().-]', '', 'g') ~ '^\+?[1-9][0-9]{7,14}$';
UPDATE "bd"."facilitators" SET "phone" = regexp_replace("phone", '[\s().-]', '', 'g')
  WHERE "phone" !~ '^\+?[1-9][0-9]{7,14}$' AND regexp_replace("phone", '[\s().-]', '', 'g') ~ '^\+?[1-9][0-9]{7,14}$';
UPDATE "bd"."ambassadors" SET "phone" = regexp_replace("phone", '[\s().-]', '', 'g')
  WHERE "phone" IS NOT NULL AND "phone" !~ '^\+?[1-9][0-9]{7,14}$' AND regexp_replace("phone", '[\s().-]', '', 'g') ~ '^\+?[1-9][0-9]{7,14}$';

-- 2. La règle en base. NOT VALID : elle s'applique à toute écriture nouvelle ou modifiée, sans bloquer la migration si d'anciennes lignes
--    non conformes subsistent (COALESCE : un résultat inconnu ne passe pas pour vrai).
ALTER TABLE "bd"."companies" ADD CONSTRAINT "companies_phone_format" CHECK (COALESCE("phone" IS NULL OR "phone" ~ '^\+?[1-9][0-9]{7,14}$', false)) NOT VALID;
ALTER TABLE "bd"."contacts" ADD CONSTRAINT "contacts_phone_format" CHECK (COALESCE("phone" IS NULL OR "phone" ~ '^\+?[1-9][0-9]{7,14}$', false)) NOT VALID;
ALTER TABLE "bd"."facilitators" ADD CONSTRAINT "facilitators_phone_format" CHECK (COALESCE("phone" ~ '^\+?[1-9][0-9]{7,14}$', false)) NOT VALID;
ALTER TABLE "bd"."ambassadors" ADD CONSTRAINT "ambassadors_phone_format" CHECK (COALESCE("phone" IS NULL OR "phone" ~ '^\+?[1-9][0-9]{7,14}$', false)) NOT VALID;

-- 3. Rapport des lignes encore non conformes (à corriger à la main, puis `ALTER TABLE ... VALIDATE CONSTRAINT ...`) :
--      SELECT id, phone FROM bd.companies   WHERE phone IS NOT NULL AND phone !~ '^\+?[1-9][0-9]{7,14}$';
--      SELECT id, phone FROM bd.contacts    WHERE phone IS NOT NULL AND phone !~ '^\+?[1-9][0-9]{7,14}$';
--      SELECT id, phone FROM bd.facilitators WHERE phone !~ '^\+?[1-9][0-9]{7,14}$';
--      SELECT id, phone FROM bd.ambassadors WHERE phone IS NOT NULL AND phone !~ '^\+?[1-9][0-9]{7,14}$';
