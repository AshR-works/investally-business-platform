-- S3.6 Documents : état de l'analyse antivirus de chaque version (l'analyse est livrée en S7 ; PENDING d'ici là).
CREATE TYPE "docs"."ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED');

ALTER TABLE "docs"."document_versions" ADD COLUMN "scan_status" "docs"."ScanStatus" NOT NULL DEFAULT 'PENDING';

-- Une version est immuable : son contenu (clé, nom, type, taille, empreinte) ne change jamais. Seul le résultat de
-- l'analyse antivirus peut évoluer (PENDING → CLEAN ou INFECTED).
CREATE OR REPLACE FUNCTION "docs".guard_document_version_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.document_id <> OLD.document_id
     OR NEW.version_number <> OLD.version_number
     OR NEW.storage_key <> OLD.storage_key
     OR NEW.file_name <> OLD.file_name
     OR NEW.mime_type <> OLD.mime_type
     OR NEW.size_bytes <> OLD.size_bytes
     OR NEW.sha256 <> OLD.sha256
     OR NEW.uploaded_by <> OLD.uploaded_by
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Une version de document est immuable (seul scan_status peut changer)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_versions_immutable
  BEFORE UPDATE ON "docs"."document_versions"
  FOR EACH ROW EXECUTE FUNCTION "docs".guard_document_version_immutable();

-- Jamais de suppression d'une version (la suppression d'un document est logique : statut ARCHIVED).
CREATE OR REPLACE FUNCTION "docs".refuse_document_version_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Une version de document ne se supprime jamais (archiver le document)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_versions_no_delete
  BEFORE DELETE ON "docs"."document_versions"
  FOR EACH ROW EXECUTE FUNCTION "docs".refuse_document_version_delete();
