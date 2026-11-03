import { DomainError } from '../../../shared-kernel';

/** Normalise une adresse e-mail facultative : minuscules, forme simple `x@y.z`, 200 caractères au plus. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLocaleLowerCase('fr');
  if (!value) return null;
  if (value.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new DomainError('VALIDATION', "L'adresse e-mail n'est pas valide");
  }
  return value;
}

/** Un numéro compte de 8 à 15 chiffres (15 : maximum de la norme internationale, indicatif du pays compris). */
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;

/** Espaces insécables (copier-coller) : traités comme des espaces. */
const EXOTIC_SPACES = /[\u00a0\u202f]/g;

/**
 * Règle des numéros de téléphone (observation de recette 1) : seuls les chiffres, les espaces et un « + » en première position sont
 * acceptés ; le premier chiffre (après le « + ») n'est pas 0 ; de 8 à 15 chiffres. Les espaces se saisissent librement et sont
 * retirés à l'enregistrement. Retourne le message d'erreur, ou `null` si le numéro est valide. La même règle est reprise par l'interface.
 */
export function phoneProblem(raw: string): string | null {
  const value = raw.replace(EXOTIC_SPACES, ' ').trim();
  if (/[^0-9+ ]/.test(value)) return "Le numéro ne peut contenir que des chiffres, des espaces et un « + » au début.";
  const compact = value.replace(/ /g, '');
  if (compact.indexOf('+', 1) !== -1) return "Le « + » n'est accepté qu'au début du numéro, une seule fois.";
  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  if (digits.startsWith('0')) return "Le numéro ne doit pas commencer par 0 : indiquez l'indicatif du pays (ex. +237 699 12 34 56).";
  if (digits.length > PHONE_MAX_DIGITS) return `Le numéro ne peut pas dépasser ${PHONE_MAX_DIGITS} chiffres.`;
  if (digits.length < PHONE_MIN_DIGITS) return `Le numéro est trop court (${PHONE_MIN_DIGITS} chiffres au moins).`;
  return null;
}

/** Normalise un numéro de téléphone : validé par `phoneProblem`, enregistré sans espace (« +237699123456 »). */
export function normalizePhone(raw: string | null | undefined, options: { required: boolean }): string | null {
  const value = (raw ?? '').trim();
  if (!value) {
    if (options.required) throw new DomainError('VALIDATION', 'Le numéro de téléphone est obligatoire');
    return null;
  }
  const problem = phoneProblem(value);
  if (problem) throw new DomainError('VALIDATION', problem);
  return value.replace(EXOTIC_SPACES, '').replace(/ /g, '');
}
