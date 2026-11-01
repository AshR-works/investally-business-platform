/** Ce que l'utilisateur saisit pour enregistrer une décharge signée. */
export interface ReceiptForm {
  receivedOn: string;
  receivedBy: string;
}

export type ReceiptField = keyof ReceiptForm;
export type ReceiptErrors = Partial<Record<ReceiptField, string>>;

/** Date du jour au format « AAAA-MM-JJ » (UTC, comme le serveur : une date « de demain » serait refusée). */
export const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export const EMPTY_RECEIPT_FORM = (now: Date = new Date()): ReceiptForm => ({ receivedOn: todayIso(now), receivedBy: '' });

/** Vrai pour une date « AAAA-MM-JJ » qui existe (le 31 février non). */
export function isRealDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
}

/**
 * Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : date réelle, ni dans le futur ni avant le
 * dépôt de l'offre ; nom obligatoire de 150 caractères au plus.
 */
export function validateReceiptFields(form: ReceiptForm, context: { today: string; submittedOn: string | null }): ReceiptErrors {
  const errors: ReceiptErrors = {};
  const date = form.receivedOn.trim();
  if (!date) errors.receivedOn = 'La date de réception est obligatoire.';
  else if (!isRealDate(date)) errors.receivedOn = 'La date de réception n’est pas valide.';
  else if (date > context.today) errors.receivedOn = 'La date de réception ne peut pas être dans le futur.';
  else if (context.submittedOn && date < context.submittedOn) errors.receivedOn = 'La date de réception ne peut pas précéder le dépôt de l’offre.';
  const person = form.receivedBy.trim().replace(/\s+/g, ' ');
  if (!person) errors.receivedBy = 'Le nom de la personne qui a remis la décharge est obligatoire.';
  else if (person.length > 150) errors.receivedBy = 'Le nom ne peut dépasser 150 caractères.';
  return errors;
}

/** Corps de l'enregistrement d'une décharge. */
export function buildReceiptBody(offerId: string, form: ReceiptForm): Record<string, unknown> {
  return { offerId, receivedOn: form.receivedOn.trim(), receivedBy: form.receivedBy.trim() };
}
