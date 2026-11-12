import { DomainError } from '../../../shared-kernel';

/** Devise par défaut d'un montant fixe : franc CFA d'Afrique centrale (décision du 2026-10-29). */
export const DEFAULT_CURRENCY = 'XAF';

export enum CommissionType {
  Fixed = 'FIXED',
  Percent = 'PERCENT',
}

/**
 * Objet-valeur : commission du facilitateur, soit un montant fixe dans une devise (ISO 4217), soit un pourcentage
 * (jusqu'à 100). Le montant est gardé en texte décimal pour ne jamais passer par un nombre flottant.
 */
export class Commission {
  private constructor(
    readonly type: CommissionType,
    readonly value: string,
    readonly currency: string | null,
  ) {}

  static of(input: { type: string; value: string | number; currency?: string | null }): Commission {
    const type = input.type as CommissionType;
    if (type !== CommissionType.Fixed && type !== CommissionType.Percent) {
      throw new DomainError('VALIDATION', 'Le type de commission doit être « fixe » ou « pourcentage »');
    }
    const text = String(input.value).trim().replace(',', '.');
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
      throw new DomainError('VALIDATION', 'La commission doit être un nombre positif (deux décimales au plus)');
    }
    const value = Number(text).toFixed(2);
    if (type === CommissionType.Percent) {
      if (Number(value) > 100) throw new DomainError('VALIDATION', 'Un pourcentage de commission ne peut dépasser 100');
      if (input.currency) throw new DomainError('VALIDATION', "Un pourcentage n'a pas de devise");
      return new Commission(type, value, null);
    }
    // Devise par défaut : le FCFA d'Afrique centrale (XAF) ; « FCFA » saisi tel quel est reconnu comme XAF.
    const typed = (input.currency ?? '').trim().toUpperCase();
    const currency = typed === '' || typed === 'FCFA' ? DEFAULT_CURRENCY : typed;
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new DomainError('VALIDATION', 'La devise doit comporter trois lettres (ex. XAF, EUR)');
    }
    return new Commission(type, value, currency);
  }
}
