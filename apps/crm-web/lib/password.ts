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

/** Une règle de mot de passe affichée en direct, avec son état. */
export interface PasswordRule {
  label: string;
  met: boolean;
}

/**
 * Règles du mot de passe avec leur état (respectée ou non), pour la liste affichée pendant la saisie. Même règle que
 * `passwordHints` ; le serveur reste seul juge.
 */
export function passwordRules(password: string, email = ''): PasswordRule[] {
  const unmet = new Set(passwordHints(password, email));
  const rules = [`Au moins ${PASSWORD_MIN_LENGTH} caractères`];
  if (email.split('@')[0]?.length >= 4) rules.push('Ne contient pas votre identifiant e-mail');
  return rules.map((label) => ({ label, met: password.length > 0 && !unmet.has(label) }));
}

