/** Date seule au format français (ex. 21/10/2026) ; « — » si la date est absente ou illisible. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

/** Taille lisible en français (« 850 o », « 12,4 Ko », « 3,2 Mo ») ; « — » si la valeur n'est pas un nombre positif. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

/** Extension en minuscules, sans le point (« Rapport.PDF » → « pdf ») ; vide s'il n'y en a pas. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * Contrôle de confort AVANT l'envoi (le serveur reste seul juge : il reconnaît le format par le contenu) : renvoie le
 * message à afficher si le fichier est vide, trop gros ou d'une extension non acceptée, sinon `null`.
 */
export function precheckFile(file: { name: string; size: number }, rules: { maxBytes: number; formats: readonly string[] }): string | null {
  if (file.size === 0) return 'Le fichier est vide.';
  if (file.size > rules.maxBytes) return `Le fichier dépasse la taille maximale (${formatBytes(rules.maxBytes)}).`;
  if (!rules.formats.includes(extensionOf(file.name))) return `Formats acceptés : ${rules.formats.map((f) => f.toUpperCase()).join(', ')}.`;
  return null;
}

