/** Longueur du code du second facteur (TOTP) : six chiffres. */
export const OTP_LENGTH = 6;

/** Ne garde que les chiffres (le collage « 123 456 » ou « 123-456 » devient « 123456 »). */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valeur après saisie de `raw` dans la case `index`. Un seul chiffre remplace ou complète à cet emplacement (jamais de
 * trou : une case lointaine complète à la suite des chiffres déjà saisis) ; plusieurs chiffres (collage, saisie
 * automatique du code reçu) remplissent à partir de la case ; une saisie sans chiffre efface la case.
 */
export function applyInput(value: string, index: number, raw: string, length = OTP_LENGTH): string {
  const digits = digitsOnly(raw);
  if (digits.length === 0) return value.slice(0, index) + value.slice(index + 1);
  if (digits.length > 1) return (value.slice(0, Math.min(index, value.length)) + digits).slice(0, length);
  if (index >= value.length) return (value + digits).slice(0, length);
  return value.slice(0, index) + digits + value.slice(index + 1);
}

/** Valeur après « Retour arrière » sur une case vide : le chiffre précédent est effacé. */
export function backspaceOnEmpty(value: string, index: number): string {
  return index > 0 ? value.slice(0, index - 1) + value.slice(index) : value;
}

/** Index de la case qui doit recevoir le focus après une saisie aboutissant à `value`. */
export function nextFocus(value: string, length = OTP_LENGTH): number {
  return Math.min(value.length, length - 1);
}
