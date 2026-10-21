/** Date seule au format français (ex. 21/10/2026) ; « — » si la date est absente ou illisible. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}
