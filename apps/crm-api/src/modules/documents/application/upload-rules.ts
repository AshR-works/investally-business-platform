import { DOCUMENT_CATEGORIES, FORMATS, MAX_FILE_BYTES } from '../domain/document-policy';

/** Taille maximale d'un envoi, exposée à la couche de présentation (qui borne la lecture du corps de la requête). */
export const MAX_UPLOAD_BYTES = MAX_FILE_BYTES;

/** Règles d'envoi publiées par l'API : taille maximale, extensions acceptées, catégories. L'interface les affiche sans les dupliquer. */
export function uploadRules(): { maxBytes: number; formats: string[]; categories: readonly { code: string; label: string }[] } {
  return {
    maxBytes: MAX_FILE_BYTES,
    formats: Object.values(FORMATS).flatMap((f) => [...f.extensions]),
    categories: DOCUMENT_CATEGORIES,
  };
}
