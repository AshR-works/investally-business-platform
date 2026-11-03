import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'API applique la même règle, sur le même jeu d'essai.
import { normalizePhone, phoneProblem as serverProblem } from '../../crm-api/src/modules/business-development/domain/contact-info';
import { INVALID_PHONES, VALID_PHONES } from '../../crm-api/test/support/phone-cases';
import { validateAmbassadorFields, EMPTY_AMBASSADOR_FORM } from '../lib/ambassadors';
import { validateContactFields, EMPTY_CONTACT_FORM } from '../lib/contacts';
import { cleanPhone, PHONE_HINT, phoneProblem } from '../lib/phone';

describe('téléphone : règle unique côté interface', () => {
  it.each(VALID_PHONES)('accepte « %s » et le nettoie en %s', (raw, stored) => {
    expect(phoneProblem(raw)).toBeNull();
    expect(cleanPhone(raw)).toBe(stored);
  });
  it.each(INVALID_PHONES)('refuse « %s » avec le message du serveur', (raw, message) => {
    expect(phoneProblem(raw)).toMatch(message);
  });
  it('même décision et même message que le domaine réel du serveur, sur tout le jeu d’essai', () => {
    for (const [raw] of [...VALID_PHONES, ...INVALID_PHONES]) {
      expect(phoneProblem(raw)).toBe(serverProblem(raw));
      if (!serverProblem(raw)) expect(cleanPhone(raw)).toBe(normalizePhone(raw, { required: false }));
    }
  });
  it('les formulaires (contact, ambassadeur) reprennent la règle ; un champ vide reste permis', () => {
    expect(validateContactFields({ ...EMPTY_CONTACT_FORM, companyId: 'c', lastName: 'A', firstName: 'B', phone: '0699123456' }).phone).toMatch(/commencer par 0/);
    expect(validateContactFields({ ...EMPTY_CONTACT_FORM, companyId: 'c', lastName: 'A', firstName: 'B', phone: '+237 699 12 34 56' }).phone).toBeUndefined();
    expect(validateContactFields({ ...EMPTY_CONTACT_FORM, companyId: 'c', lastName: 'A', firstName: 'B', phone: '' }).phone).toBeUndefined();
    expect(validateAmbassadorFields({ ...EMPTY_AMBASSADOR_FORM(), companyId: 'c', lastName: 'A', firstName: 'B', phone: '+237-699123456' }, { today: '2026-11-03' }).phone).toMatch(/que des chiffres/);
  });
  it('l’aide rappelle l’indicatif du pays', () => {
    expect(PHONE_HINT).toMatch(/\+237 699 12 34 56/);
  });
});
