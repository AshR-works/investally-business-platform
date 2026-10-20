import { COMMON_PASSWORDS } from './common-passwords';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordContext {
  email: string;
  displayName: string;
}

/**
 * Politique de mot de passe (SECURITY.md §2.1, NIST SP 800-63B) : la longueur prime sur la complexité.
 * Pure : la vérification de réutilisation (hachages passés) se fait dans l'Application.
 * Retourne la liste des violations (vide = accepté), sans jamais reprendre le mot de passe dans les messages.
 */
export function checkPasswordPolicy(password: string, context: PasswordContext): string[] {
  const problems: string[] = [];
  const length = [...(password ?? '')].length; // compte les caractères, pas les unités UTF-16

  if (length < PASSWORD_MIN_LENGTH) problems.push(`Au moins ${PASSWORD_MIN_LENGTH} caractères`);
  if (length > PASSWORD_MAX_LENGTH) problems.push(`Au plus ${PASSWORD_MAX_LENGTH} caractères`);
  if (length === 0) return problems;

  const lower = password.toLocaleLowerCase('fr');
  if (COMMON_PASSWORDS.has(lower)) problems.push('Mot de passe trop courant');
  if (new Set(lower).size <= 2) problems.push('Mot de passe trop répétitif');

  const local = context.email.split('@')[0]?.toLocaleLowerCase('fr') ?? '';
  if (local.length >= 4 && lower.includes(local)) problems.push("Ne doit pas contenir votre adresse e-mail");

  const nameParts = context.displayName
    .toLocaleLowerCase('fr')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 4);
  if (nameParts.some((part) => lower.includes(part))) problems.push('Ne doit pas contenir votre nom');

  return problems;
}
