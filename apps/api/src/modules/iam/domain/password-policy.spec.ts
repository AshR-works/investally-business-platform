import { checkPasswordPolicy } from './password-policy';

const ctx = { email: 'marie.dupont@investally.test', displayName: 'Marie Dupont' };

describe('checkPasswordPolicy', () => {
  it('accepte une phrase de passe longue sans règle de composition', () => {
    expect(checkPasswordPolicy('cheval agrafeuse nuage bleu', ctx)).toEqual([]);
  });

  it('refuse moins de 12 caractères', () => {
    expect(checkPasswordPolicy('Court1!', ctx)).toContain('Au moins 12 caractères');
  });

  it('accepte exactement 12 caractères et refuse 129', () => {
    expect(checkPasswordPolicy('x7Kq2mZp9Lw4', ctx)).toEqual([]);
    expect(checkPasswordPolicy('a1B2'.repeat(33), ctx)).toContain('Au plus 128 caractères');
  });

  it('compte les caractères et non les unités UTF-16 (6 émojis = 12 unités mais 6 caractères)', () => {
    expect(checkPasswordPolicy('😀'.repeat(6), ctx)).toContain('Au moins 12 caractères');
    expect(checkPasswordPolicy('😀😁😂😃😄😅😆😇😈😉😊😋', ctx)).not.toContain('Au moins 12 caractères');
  });

  it('refuse un mot de passe courant, sans tenir compte de la casse', () => {
    expect(checkPasswordPolicy('Azertyuiop123', ctx)).toContain('Mot de passe trop courant');
    expect(checkPasswordPolicy('PASSWORD1234', ctx)).toContain('Mot de passe trop courant');
  });

  it('refuse un mot de passe répétitif', () => {
    expect(checkPasswordPolicy('abababababab', ctx)).toContain('Mot de passe trop répétitif');
  });

  it("refuse un mot de passe dérivé de l'e-mail", () => {
    expect(checkPasswordPolicy('xx-marie.dupont-xx', ctx)).toContain('Ne doit pas contenir votre adresse e-mail');
  });

  it('refuse un mot de passe qui contient le nom (accents et casse ignorés)', () => {
    expect(checkPasswordPolicy('le chat de Dupont 2026', ctx)).toContain('Ne doit pas contenir votre nom');
  });

  it("ne reprend jamais le mot de passe dans les messages d'erreur", () => {
    const secret = 'PasswordSecret-42';
    const messages = checkPasswordPolicy(secret, { email: 'a@b.test', displayName: 'x' }).join(' ');
    expect(messages).not.toContain(secret);
  });

  it('retourne une seule violation de longueur pour un mot de passe vide', () => {
    expect(checkPasswordPolicy('', ctx)).toEqual(['Au moins 12 caractères']);
  });
});
