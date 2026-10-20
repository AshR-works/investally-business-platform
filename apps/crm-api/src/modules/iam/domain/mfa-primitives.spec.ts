import { base32Decode, base32Encode } from './base32';
import { formatRecoveryCode, normalizeRecoveryCode, RECOVERY_ALPHABET } from './recovery-codes';
import { hotp, otpauthUri, timeStepOf, totp, verifyTotp } from './totp';

/** Secret des vecteurs de test des RFC 4226 / 6238 : l'ASCII « 12345678901234567890 ». */
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('base32 (A1) — vecteurs RFC 4648 §10', () => {
  it.each([
    ['', ''], ['f', 'MY'], ['fo', 'MZXQ'], ['foo', 'MZXW6'], ['foob', 'MZXW6YQ'], ['fooba', 'MZXW6YTB'], ['foobar', 'MZXW6YTBOI'],
  ])('encode %p → %p', (plain, encoded) => {
    expect(base32Encode(Buffer.from(plain))).toBe(encoded);
  });

  it('décode (aller-retour) tous les vecteurs, tolère minuscules, espaces et remplissage', () => {
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb oi').toString()).toBe('foobar');
    expect(base32Decode('MZXW6===').toString()).toBe('foo');
    const random = Buffer.from(Array.from({ length: 20 }, (_, i) => (i * 37 + 11) % 256));
    expect(base32Decode(base32Encode(random)).equals(random)).toBe(true);
  });

  it.each(['1', '0', 'MZXW6!', 'MZ-XW', 'é'])('refuse le caractère invalide dans %p', (bad) => {
    expect(() => base32Decode(bad)).toThrow();
  });

  it('refuse une chaîne vide', () => {
    expect(() => base32Decode('   ')).toThrow();
  });
});

describe('HOTP — vecteurs RFC 4226 annexe D (6 chiffres)', () => {
  it.each([
    [0, '755224'], [1, '287082'], [2, '359152'], [3, '969429'], [4, '338314'],
    [5, '254676'], [6, '287922'], [7, '162583'], [8, '399871'], [9, '520489'],
  ])('compteur %i → %s', (counter, expected) => {
    expect(hotp(RFC_SECRET, counter)).toBe(expected);
  });
});

describe('TOTP (A2) — vecteurs RFC 6238 annexe B (SHA-1)', () => {
  it.each([
    [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
    [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130'],
  ])('à T=%i, 8 chiffres → %s', (seconds, expected) => {
    expect(totp(RFC_SECRET, seconds * 1000, 8)).toBe(expected);
  });

  it('les mêmes instants en 6 chiffres sont les 6 derniers chiffres (zéros initiaux conservés)', () => {
    expect(totp(RFC_SECRET, 59_000)).toBe('287082');
    expect(totp(RFC_SECRET, 1111111109_000)).toBe('081804');
    expect(totp(RFC_SECRET, 1234567890_000)).toBe('005924');
  });

  it('le pas de temps est de 30 secondes', () => {
    expect(timeStepOf(59_000)).toBe(1);
    expect(timeStepOf(60_000)).toBe(2);
  });
});

describe('verifyTotp — fenêtre et anti-rejeu (A2, A3)', () => {
  const now = 1_700_000_000_000; // un instant quelconque
  const step = timeStepOf(now);
  const codeAt = (s: number) => hotp(RFC_SECRET, s);
  const verify = (code: string, lastUsedStep: number | null = null) => verifyTotp({ secret: RFC_SECRET, code, nowMs: now, lastUsedStep });

  it('accepte le pas courant et retourne ce pas', () => {
    expect(verify(codeAt(step))).toEqual({ ok: true, step });
  });

  it('accepte une dérive d\'un pas dans les deux sens, refuse deux pas', () => {
    expect(verify(codeAt(step - 1))).toEqual({ ok: true, step: step - 1 });
    expect(verify(codeAt(step + 1))).toEqual({ ok: true, step: step + 1 });
    expect(verify(codeAt(step - 2))).toEqual({ ok: false });
    expect(verify(codeAt(step + 2))).toEqual({ ok: false });
  });

  it('REJEU : un code dont le pas a déjà été utilisé est refusé', () => {
    expect(verify(codeAt(step), step)).toEqual({ ok: false });
  });

  it('REJEU : un pas antérieur au dernier pas utilisé est refusé, un pas postérieur accepté', () => {
    expect(verify(codeAt(step - 1), step)).toEqual({ ok: false });
    expect(verify(codeAt(step + 1), step)).toEqual({ ok: true, step: step + 1 });
  });

  it.each(['', '12345', '1234567', 'abcdef', '12 3456', '١٢٣٤٥٦', null as unknown as string, undefined as unknown as string])(
    'refuse sans erreur le format invalide %p',
    (bad) => {
      expect(verify(bad)).toEqual({ ok: false });
    },
  );

  it('tolère les espaces autour du code saisi', () => {
    expect(verify(`  ${codeAt(step)} `)).toEqual({ ok: true, step });
  });

  it('refuse un code valide pour un autre secret', () => {
    const other = Buffer.from('autre-secret-de-test-xx');
    expect(verify(hotp(other, step))).toEqual({ ok: false });
  });

  it('ne plante pas près de l\'instant 0 (pas négatifs ignorés)', () => {
    expect(verifyTotp({ secret: RFC_SECRET, code: '000000', nowMs: 0, lastUsedStep: null })).toBeDefined();
  });
});

describe('otpauthUri', () => {
  it('produit une URI scannable avec tous les paramètres, correctement encodée', () => {
    const uri = otpauthUri({ secretBase32: 'MZXW6YTBOI', accountName: 'marie@investally.test', issuer: 'Investally CRM' });
    expect(uri.startsWith('otpauth://totp/Investally%20CRM:marie%40investally.test?')).toBe(true);
    const params = new URL(uri).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      secret: 'MZXW6YTBOI', issuer: 'Investally CRM', algorithm: 'SHA1', digits: '6', period: '30',
    });
  });
});

describe('codes de secours (A6)', () => {
  it("l'alphabet n'a aucun caractère ambigu et 32 symboles (5 bits chacun)", () => {
    expect(RECOVERY_ALPHABET).toHaveLength(32);
    for (const ambiguous of ['I', 'O', '0', '1']) expect(RECOVERY_ALPHABET).not.toContain(ambiguous);
  });

  it('formate en deux groupes de 5', () => {
    expect(formatRecoveryCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
  });

  it.each([
    ['abcde-fghjk', 'ABCDEFGHJK'], ['ABCDE FGHJK', 'ABCDEFGHJK'], ['  abcdefghjk  ', 'ABCDEFGHJK'], ['ABCDE-FGH-JK', 'ABCDEFGHJK'],
  ])('normalise %p', (input, expected) => {
    expect(normalizeRecoveryCode(input)).toBe(expected);
  });

  it.each(['', 'ABCDE', 'ABCDEFGHJKL', 'ABCDEFGHI0', 'ABCDEFGHIO', 'ABCDE-FGHJ!', null as unknown as string])(
    'rejette la saisie impossible %p',
    (bad) => {
      expect(normalizeRecoveryCode(bad)).toBeNull();
    },
  );
});
