/** Longueur minimale d'un mot de passe (la même règle que côté serveur, qui reste seul juge). */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Indications affichées pendant la saisie (longueur, identifiant e-mail contenu) ; la règle qui fait foi est celle du
 * serveur.
 */
export function passwordHints(password: string, email = ''): string[] {
  const hints: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) hints.push(`Au moins ${PASSWORD_MIN_LENGTH} caractères`);
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local)) hints.push('Ne contient pas votre identifiant e-mail');
  return hints;
}
