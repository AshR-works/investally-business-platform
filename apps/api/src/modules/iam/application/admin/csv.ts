/**
 * CSV pour tableur français (Excel, LibreOffice) : séparateur « ; », guillemets si nécessaire, fin de ligne CRLF, UTF-8 **avec marque d'ordre des octets (BOM)**
 * pour que les accents soient lus correctement.
 *
 * **Injection de formule** : une cellule de texte qui commence par `=`, `+`, `-`, `@` (ou une tabulation / un retour chariot) serait interprétée comme une formule
 * par le tableur, ce qui permet d'exécuter une commande ou de siphonner des données depuis un fichier d'audit ouvert par un administrateur. Elle est neutralisée
 * par une apostrophe en tête (la valeur s'affiche telle quelle, sans être évaluée). Les nombres et les booléens ne sont jamais du texte libre.
 */
export type CsvCell = string | number | boolean | null | undefined;

const BOM = '\uFEFF';
const SEPARATOR = ';';
const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralise une cellule de texte qui serait lue comme une formule. */
export function neutralizeCell(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** Une cellule prête à être écrite : `oui` / `non` pour un booléen, vide pour l'absence, texte neutralisé et guillemeté si besoin. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = neutralizeCell(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Le fichier complet : marque d'ordre des octets, en-tête, lignes ; les lignes dont la longueur n'est pas celle de l'en-tête sont refusées (une colonne décalée fausse un audit). */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  for (const row of rows) {
    if (row.length !== header.length) throw new Error(`Ligne de ${row.length} colonnes pour un en-tête de ${header.length}`);
  }
  return `${BOM}${[header, ...rows].map((line) => line.map(csvCell).join(SEPARATOR)).join('\r\n')}\r\n`;
}
