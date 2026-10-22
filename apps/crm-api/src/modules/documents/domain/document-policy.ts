import { DomainError } from '../../../shared-kernel';

/** Taille maximale d'un fichier (10 Mo). Décision du 2026-10-22 (proposition par défaut, modifiable ici). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Formats acceptés : leur type réel est reconnu par la SIGNATURE du contenu, jamais par ce que déclare le client. */
export type DocumentFormat = 'PDF' | 'JPEG' | 'PNG' | 'DOCX' | 'XLSX';

/** Extensions et type MIME de chaque format accepté. */
export const FORMATS: Record<DocumentFormat, { extensions: readonly string[]; mimeType: string }> = {
  PDF: { extensions: ['pdf'], mimeType: 'application/pdf' },
  JPEG: { extensions: ['jpg', 'jpeg'], mimeType: 'image/jpeg' },
  PNG: { extensions: ['png'], mimeType: 'image/png' },
  DOCX: { extensions: ['docx'], mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  XLSX: { extensions: ['xlsx'], mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};

/** Catégories de documents (liste initiale proposée, modifiable ici). */
export const DOCUMENT_CATEGORIES: readonly { code: string; label: string }[] = [
  { code: 'DECHARGE', label: 'Décharge' },
  { code: 'CONTRAT', label: 'Contrat' },
  { code: 'AGREMENT', label: 'Agrément signé' },
  { code: 'JUSTIFICATIF', label: 'Justificatif' },
  { code: 'FACTURE', label: 'Facture' },
  { code: 'AUTRE', label: 'Autre' },
];

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const PDF_SIGNATURE = Buffer.from('%PDF-');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Reconnaît le format d'après le CONTENU (octets magiques). Un DOCX ou un XLSX est une archive ZIP qui contient
 * `word/` ou `xl/` ; une archive qui embarque des macros (`vbaProject.bin`) est refusée. Renvoie `null` si le format
 * n'est pas accepté.
 */
export function detectFormat(bytes: Buffer): DocumentFormat | null {
  if (bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) return 'PDF';
  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'PNG';
  if (bytes.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return 'JPEG';
  if (bytes.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE)) {
    if (bytes.includes('vbaProject.bin')) return null;
    if (!bytes.includes('[Content_Types].xml')) return null;
    if (bytes.includes('word/')) return 'DOCX';
    if (bytes.includes('xl/')) return 'XLSX';
  }
  return null;
}

/** Longueur maximale d'un nom de fichier conservé (colonne `file_name` : 255). */
const MAX_NAME_LENGTH = 200;

/**
 * Nom de fichier conservé pour l'affichage et le téléchargement : sans chemin, sans caractères de contrôle ni
 * caractères réservés, borné. Ce nom n'est JAMAIS utilisé comme chemin de stockage (la clé de stockage est aléatoire).
 */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return cleaned.length > MAX_NAME_LENGTH ? cleaned.slice(cleaned.length - MAX_NAME_LENGTH) : cleaned;
}

/** Extension en minuscules, sans le point (`rapport.PDF` → `pdf`) ; chaîne vide s'il n'y en a pas. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** Fichier accepté : nom assaini, format reconnu et type MIME correspondant. */
export interface AcceptedFile {
  fileName: string;
  format: DocumentFormat;
  mimeType: string;
}

/**
 * Contrôle d'un fichier envoyé : non vide, taille maximale, nom exploitable, format reconnu par signature, et
 * extension COHÉRENTE avec ce format (un `.pdf` qui contient autre chose est refusé, comme un `.exe` renommé).
 */
export function checkUpload(rawFileName: string, bytes: Buffer): AcceptedFile {
  if (bytes.length === 0) throw new DomainError('VALIDATION', 'Le fichier est vide');
  if (bytes.length > MAX_FILE_BYTES) throw new DomainError('VALIDATION', `Le fichier dépasse la taille maximale de ${MAX_FILE_BYTES / (1024 * 1024)} Mo`);
  const fileName = sanitizeFileName(rawFileName);
  if (fileName.length === 0) throw new DomainError('VALIDATION', 'Nom de fichier invalide');
  const format = detectFormat(bytes);
  if (!format) throw new DomainError('VALIDATION', 'Format non accepté (PDF, JPG, PNG, DOCX ou XLSX sans macro)');
  if (!FORMATS[format].extensions.includes(extensionOf(fileName))) {
    throw new DomainError('VALIDATION', `L'extension du fichier ne correspond pas à son contenu (${format})`);
  }
  return { fileName, format, mimeType: FORMATS[format].mimeType };
}

/** Catégorie valide (ou absente) ; une catégorie inconnue est refusée. */
export function checkCategory(category: string | null | undefined): string | null {
  if (category === undefined || category === null || category === '') return null;
  if (!DOCUMENT_CATEGORIES.some((c) => c.code === category)) throw new DomainError('VALIDATION', 'Catégorie de document inconnue');
  return category;
}
