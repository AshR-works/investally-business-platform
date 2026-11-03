import { DomainError } from '../../../shared-kernel';
import { INVALID_PHONES, VALID_PHONES } from '../../../../test/support/phone-cases';
import { normalizePhone, phoneProblem } from './contact-info';

describe('Téléphone — règle unique', () => {
  it.each(VALID_PHONES)('accepte « %s » et l’enregistre sans espace : %s', (raw, stored) => {
    expect(phoneProblem(raw)).toBeNull();
    expect(normalizePhone(raw, { required: false })).toBe(stored);
  });

  it.each(INVALID_PHONES)('refuse « %s » avec un message précis', (raw, message) => {
    expect(phoneProblem(raw)).toMatch(message);
    expect(() => normalizePhone(raw, { required: false })).toThrow(DomainError);
  });

  it('un numéro vide est permis sauf s’il est obligatoire', () => {
    expect(normalizePhone('', { required: false })).toBeNull();
    expect(normalizePhone('   ', { required: false })).toBeNull();
    expect(normalizePhone(undefined, { required: false })).toBeNull();
    expect(() => normalizePhone('  ', { required: true })).toThrow(/obligatoire/);
  });

  it('la valeur enregistrée respecte toujours le motif de la base : « + » facultatif, premier chiffre non nul, 8 à 15 chiffres', () => {
    for (const [raw] of VALID_PHONES) expect(normalizePhone(raw, { required: false })).toMatch(/^\+?[1-9][0-9]{7,14}$/);
  });
});
