/** Alphabet sans caractères ambigus (ni I, O, 0, 1) : 32 symboles = 5 bits par caractère. */
export const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_LENGTH = 10; // 50 bits d'entropie
export const RECOVERY_CODE_COUNT = 10;

/** Forme lisible : `ABCDE-FGHJK`. */
export function formatRecoveryCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/**
 * Normalise la saisie d'un utilisateur (casse, tirets, espaces) vers la forme stockée/hachée.
 * Retourne `null` si la saisie ne peut pas être un code de secours valide.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = (input ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length !== RECOVERY_CODE_LENGTH) return null;
  for (const char of cleaned) if (!RECOVERY_ALPHABET.includes(char)) return null;
  return cleaned;
}
