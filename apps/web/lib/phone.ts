/**
 * Règle des numéros de téléphone, identique à celle du serveur (`phoneProblem`, domaine de l'API) : seuls les chiffres, les espaces et
 * un « + » en première position ; premier chiffre (après le « + ») non nul ; de 8 à 15 chiffres. Les espaces se saisissent librement
 * et sont retirés à l'enregistrement. Les messages sont ceux du serveur. Un test compare les deux sur le même jeu d'essai.
 */
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;

/** Aide affichée avec chaque champ de téléphone. */
export const PHONE_HINT = 'avec l’indicatif du pays, ex. +237 699 12 34 56';

const EXOTIC_SPACES = /[\u00a0\u202f]/g;

/** Message d'erreur d'un numéro non valide, ou `null` s'il est valide (un champ vide se contrôle ailleurs). */
export function phoneProblem(raw: string): string | null {
  const value = raw.replace(EXOTIC_SPACES, ' ').trim();
  if (/[^0-9+ ]/.test(value)) return 'Le numéro ne peut contenir que des chiffres, des espaces et un « + » au début.';
  const compact = value.replace(/ /g, '');
  if (compact.indexOf('+', 1) !== -1) return 'Le « + » n\'est accepté qu\'au début du numéro, une seule fois.';
  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  if (digits.startsWith('0')) return 'Le numéro ne doit pas commencer par 0 : indiquez l\'indicatif du pays (ex. +237 699 12 34 56).';
  if (digits.length > PHONE_MAX_DIGITS) return `Le numéro ne peut pas dépasser ${PHONE_MAX_DIGITS} chiffres.`;
  if (digits.length < PHONE_MIN_DIGITS) return `Le numéro est trop court (${PHONE_MIN_DIGITS} chiffres au moins).`;
  return null;
}

/** Forme enregistrée : sans espace (« +237699123456 »). */
export const cleanPhone = (raw: string): string => raw.replace(EXOTIC_SPACES, '').replace(/ /g, '');
