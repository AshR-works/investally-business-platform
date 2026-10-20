import { DomainError } from '../../../shared-kernel';
import { Company } from './company';
import { CompanyStatus } from './company-status';

const now = new Date('2026-10-20T10:00:00Z');

describe('Company', () => {
  it('est enregistrée comme entreprise cible et émet CompanyRegistered', () => {
    const company = Company.register({ id: 'c1', name: '  Acme   SA ', ownerUserId: 'u1', now });

    expect(company.status).toBe(CompanyStatus.Target);
    expect(company.name.value).toBe('Acme SA');
    expect(company.pullEvents().map((e) => e.name)).toEqual(['bd.company.registered']);
    expect(company.pullEvents()).toEqual([]);
  });

  it('refuse un nom vide', () => {
    expect(() => Company.register({ id: 'c1', name: '   ', ownerUserId: 'u1', now })).toThrow(DomainError);
  });

  it('refuse un nom de plus de 200 caractères', () => {
    expect(() => Company.register({ id: 'c1', name: 'x'.repeat(201), ownerUserId: 'u1', now })).toThrow(DomainError);
  });

  it('ne peut pas être archivée deux fois', () => {
    const company = Company.register({ id: 'c1', name: 'Acme', ownerUserId: 'u1', now });
    company.archive();
    expect(() => company.archive()).toThrow(/déjà archivée/);
  });

  it("la réhydratation n'émet aucun événement", () => {
    const original = Company.register({ id: 'c1', name: 'Acme', ownerUserId: 'u1', now });
    original.pullEvents();
    const copy = Company.rehydrate({
      id: original.id,
      name: original.name,
      status: original.status,
      ownerUserId: 'u1',
      sector: null,
      country: null,
      createdAt: now,
      version: 1,
    });
    expect(copy.pullEvents()).toEqual([]);
  });
});
