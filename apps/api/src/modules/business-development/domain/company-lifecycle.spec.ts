import { DomainError } from '../../../shared-kernel';
import { Company } from './company';
import { CompanyStatus } from './company-status';

const now = new Date('2026-11-05T10:00:00Z');
const fresh = () => Company.register({ id: 'c1', name: 'Acme', ownerUserId: 'u1', now });
const withContact = { contactCount: 1 };

describe('Company — statut manuel (CU-C-05)', () => {
  it('avance d’un cran : Cible → Contactée → Qualifiée (avec un contact)', () => {
    const company = fresh();
    company.changeStatus(CompanyStatus.Contacted, { contactCount: 0 });
    expect(company.status).toBe(CompanyStatus.Contacted);
    company.changeStatus(CompanyStatus.Qualified, withContact);
    expect(company.status).toBe(CompanyStatus.Qualified);
  });

  it('refuse « Qualifiée » sans contact, et le statut ne bouge pas', () => {
    const company = fresh();
    company.changeStatus(CompanyStatus.Contacted, { contactCount: 0 });
    expect(() => company.changeStatus(CompanyStatus.Qualified, { contactCount: 0 })).toThrow(/sans au moins un contact/);
    expect(company.status).toBe(CompanyStatus.Contacted);
  });

  it('refuse de sauter une étape', () => {
    expect(() => fresh().changeStatus(CompanyStatus.Qualified, withContact)).toThrow(/pas possible à la main/);
  });

  it('autorise le retour d’un cran seulement', () => {
    const company = fresh();
    company.changeStatus(CompanyStatus.Contacted, withContact);
    company.changeStatus(CompanyStatus.Qualified, withContact);
    company.changeStatus(CompanyStatus.Contacted, withContact);
    company.changeStatus(CompanyStatus.Target, withContact);
    expect(company.status).toBe(CompanyStatus.Target);
    expect(() => company.changeStatus(CompanyStatus.Target, withContact)).toThrow(/déjà ce statut/);
  });

  it('ne pose jamais « Cliente » ni « Archivée » à la main', () => {
    const company = fresh();
    company.changeStatus(CompanyStatus.Contacted, withContact);
    company.changeStatus(CompanyStatus.Qualified, withContact);
    expect(() => company.changeStatus(CompanyStatus.Client, withContact)).toThrow(DomainError);
    expect(() => company.changeStatus(CompanyStatus.Archived, withContact)).toThrow(DomainError);
  });

  it('une entreprise archivée ne change plus de statut', () => {
    const company = fresh();
    company.archive();
    expect(() => company.changeStatus(CompanyStatus.Contacted, withContact)).toThrow(DomainError);
  });
});

describe('Company — réattribution du propriétaire (D17)', () => {
  it('confie l’entreprise à un autre propriétaire', () => {
    const company = fresh();
    company.reassign('u2');
    expect(company.ownerUserId).toBe('u2');
  });

  it('refuse le même propriétaire, un propriétaire vide ou une entreprise archivée', () => {
    const company = fresh();
    expect(() => company.reassign('u1')).toThrow(/déjà responsable/);
    expect(() => company.reassign('')).toThrow(/obligatoire/);
    company.archive();
    expect(() => company.reassign('u2')).toThrow(/archivée/);
    expect(company.ownerUserId).toBe('u1');
  });
});
