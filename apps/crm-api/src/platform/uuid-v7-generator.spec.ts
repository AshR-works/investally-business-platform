import { UuidV7Generator } from './uuid-v7-generator';

describe('UuidV7Generator', () => {
  const generator = new UuidV7Generator();

  it('produit un UUID v7 valide (version 7, variante RFC)', () => {
    expect(generator.next()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('est unique et triable par date', () => {
    const before = generator.next();
    const later = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5_000);
    const after = generator.next();
    later.mockRestore();
    expect(new Set([before, after]).size).toBe(2);
    expect(after > before).toBe(true);
  });
});
