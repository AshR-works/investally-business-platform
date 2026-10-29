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

/** Normalise un numéro de téléphone : chiffres, espaces, `+ - . ( )`, au moins 6 chiffres, 40 caractères au plus. */
export function normalizePhone(raw: string | null | undefined, options: { required: boolean }): string | null {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) {
    if (options.required) throw new DomainError('VALIDATION', 'Le numéro de téléphone est obligatoire');
    return null;
  }
  if (value.length > 40 || !/^[0-9+().\- ]+$/.test(value) || value.replace(/\D/g, '').length < 6) {
    throw new DomainError('VALIDATION', "Le numéro de téléphone n'est pas valide");
  }
  return value;
}
