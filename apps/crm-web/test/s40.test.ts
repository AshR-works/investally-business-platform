import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : les méthodes de contact et les validations viennent du domaine RÉEL du serveur.
import { Commission, DEFAULT_CURRENCY as ServerDefaultCurrency } from '../../crm-api/src/modules/business-development/domain/commission';
import { ContactMethod } from '../../crm-api/src/modules/business-development/domain/facilitation';
import { normalizeEmail, normalizePhone } from '../../crm-api/src/modules/business-development/domain/contact-info';
import { buildCompanyBody, COMMISSION_TYPES, CONTACT_METHODS, contactMethodLabel, DEFAULT_CURRENCY, EMPTY_COMPANY_FORM, formatCommission, normalizeCurrency, validateCompanyForm, type CompanyForm } from '../lib/facilitation';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const form = (patch: Partial<CompanyForm> = {}): CompanyForm => ({ ...EMPTY_COMPANY_FORM, name: 'Acme', ...patch });
const withNew = (patch: Partial<CompanyForm> = {}) =>
  form({ facilitatorMode: 'new', facilitatorLastName: 'Mbarga', facilitatorFirstName: 'Paul', facilitatorPhone: '+237 699 00 11 22', ...patch });

describe('méthodes de contact : l\'interface propose exactement celles du serveur', () => {
  it('mêmes codes, tous libellés en français', () => {
    expect(CONTACT_METHODS.map((m) => m.value).sort()).toEqual(Object.values(ContactMethod).sort());
    for (const m of CONTACT_METHODS) expect(contactMethodLabel(m.value)).toBe(m.label);
    expect(contactMethodLabel('INCONNUE')).toBe('INCONNUE');
  });
  it('« message WhatsApp » et « appel » (demande métier) existent', () => {
    expect(CONTACT_METHODS.map((m) => m.label)).toEqual(expect.arrayContaining(['Message WhatsApp', 'Appel téléphonique']));
  });
  it('types de commission : mêmes codes que le serveur', () => {
    for (const t of COMMISSION_TYPES) expect(() => Commission.of({ type: t.value, value: '5', currency: t.value === 'FIXED' ? 'XAF' : undefined })).not.toThrow();
  });
});

describe('validation de la fiche : refuse ce que le serveur refuserait', () => {
  it('une fiche minimale (nom seul) est valide', () => expect(validateCompanyForm(form())).toEqual([]));
  it('nom obligatoire', () => expect(validateCompanyForm(form({ name: '  ' }))).toHaveLength(1));
  it.each([['pas-un-mail'], ['a@b'], ['a b@c.d']])('e-mail %s refusé', (email) => {
    expect(validateCompanyForm(form({ email }))).toHaveLength(1);
    expect(() => normalizeEmail(email)).toThrow();
  });
  it.each([['abc'], ['12'], ['12 34 ;']])('téléphone %s refusé', (phone) => {
    expect(validateCompanyForm(form({ phone }))).toHaveLength(1);
    expect(() => normalizePhone(phone, { required: false })).toThrow();
  });
  it('e-mail et téléphone valides acceptés des deux côtés', () => {
    expect(validateCompanyForm(form({ email: 'contact@acme.cm', phone: '+237 222 33 44 55' }))).toEqual([]);
    expect(() => normalizeEmail('contact@acme.cm')).not.toThrow();
    expect(() => normalizePhone('+237 222 33 44 55', { required: false })).not.toThrow();
  });
  it('nouveau facilitateur : nom, prénom et téléphone obligatoires', () => {
    expect(validateCompanyForm(withNew())).toEqual([]);
    expect(validateCompanyForm(withNew({ facilitatorLastName: '' }))).toHaveLength(1);
    expect(validateCompanyForm(withNew({ facilitatorFirstName: '' }))).toHaveLength(1);
    expect(validateCompanyForm(withNew({ facilitatorPhone: '' }))).toHaveLength(1);
    expect(validateCompanyForm(withNew({ facilitatorPhone: 'abc' }))).toHaveLength(1);
  });
  it('facilitateur existant : il faut en choisir un', () => {
    expect(validateCompanyForm(form({ facilitatorMode: 'existing' }))).toHaveLength(1);
    expect(validateCompanyForm(form({ facilitatorMode: 'existing', facilitatorId: 'abc' }))).toEqual([]);
  });
  it.each([
    [{ commissionType: 'PERCENT', commissionValue: '0' }, false], [{ commissionType: 'PERCENT', commissionValue: '100.01' }, false],
    [{ commissionType: 'PERCENT', commissionValue: '100' }, true], [{ commissionType: 'PERCENT', commissionValue: '7,5' }, true],
    [{ commissionType: 'FIXED', commissionValue: '100' }, true], [{ commissionType: 'FIXED', commissionValue: '100', commissionCurrency: 'FCFA' }, true],
    [{ commissionType: 'FIXED', commissionValue: '100', commissionCurrency: '' }, true], [{ commissionType: 'FIXED', commissionValue: '100', commissionCurrency: 'FRANCS' }, false],
    [{ commissionType: 'FIXED', commissionValue: '100', commissionCurrency: 'X1' }, false],
    [{ commissionType: 'FIXED', commissionValue: '100', commissionCurrency: 'xaf' }, true], [{ commissionType: 'FIXED', commissionValue: '-5', commissionCurrency: 'XAF' }, false],
    [{ commissionType: 'FIXED', commissionValue: 'abc', commissionCurrency: 'XAF' }, false],
  ] as const)('commission %j → valide : %s', (patch, valid) => {
    expect(validateCompanyForm(withNew(patch)).length === 0).toBe(valid);
    const body = buildCompanyBody(withNew(patch)) as { facilitation: { commission: { type: string; value: string; currency?: string } } };
    if (valid) expect(() => Commission.of(body.facilitation.commission)).not.toThrow();
    else expect(() => Commission.of(body.facilitation.commission)).toThrow();
  });
  it('sans facilitateur, une commission saisie avant un changement d\'avis n\'est pas contrôlée ni envoyée', () => {
    const f = form({ commissionType: 'PERCENT', commissionValue: 'n\'importe quoi' });
    expect(validateCompanyForm(f)).toEqual([]);
    expect(buildCompanyBody(f)).toEqual({ name: 'Acme' });
  });
});

describe('corps de la requête de création', () => {
  it('omet les champs vides ; ne contient jamais de propriétaire', () => {
    const body = buildCompanyBody(form({ sector: ' Banque ', email: '', phone: '' }));
    expect(body).toEqual({ name: 'Acme', sector: 'Banque' });
    expect(JSON.stringify(buildCompanyBody(withNew()))).not.toMatch(/owner/i);
  });
  it('nouveau facilitateur : tout est envoyé, espaces retirés, commentaire omis s\'il est vide', () => {
    expect(buildCompanyBody(withNew({ contactMethod: 'PHONE_CALL', isCompanyEmployee: true, facilitatorLastName: ' Mbarga ' }))).toEqual({
      name: 'Acme',
      facilitation: { contactMethod: 'PHONE_CALL', isCompanyEmployee: true, newFacilitator: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 699 00 11 22' } },
    });
    expect((buildCompanyBody(withNew({ facilitatorComment: ' Connaît le DAF ' })) as any).facilitation.newFacilitator.comment).toBe('Connaît le DAF');
  });
  it('facilitateur existant : seulement son identifiant', () => {
    const body = buildCompanyBody(form({ facilitatorMode: 'existing', facilitatorId: 'f-1' })) as any;
    expect(body.facilitation.facilitatorId).toBe('f-1');
    expect(body.facilitation.newFacilitator).toBeUndefined();
  });
  it('commission : virgule décimale convertie, devise en majuscules, pas de devise pour un pourcentage', () => {
    const fixed = buildCompanyBody(withNew({ commissionType: 'FIXED', commissionValue: '1500,5', commissionCurrency: 'xaf' })) as any;
    expect(fixed.facilitation.commission).toEqual({ type: 'FIXED', value: '1500.5', currency: 'XAF' });
    const pct = buildCompanyBody(withNew({ commissionType: 'PERCENT', commissionValue: '7,5', commissionCurrency: 'xaf' })) as any;
    expect(pct.facilitation.commission).toEqual({ type: 'PERCENT', value: '7.5' });
  });
});

describe('devise par défaut : le FCFA (XAF)', () => {
  it('la fiche vierge propose XAF ; vide ou « FCFA » donnent XAF, une autre devise reste telle quelle', () => {
    expect(EMPTY_COMPANY_FORM.commissionCurrency).toBe('XAF');
    expect(DEFAULT_CURRENCY).toBe(ServerDefaultCurrency);
    expect([normalizeCurrency(''), normalizeCurrency(' fcfa '), normalizeCurrency('xaf'), normalizeCurrency('eur')]).toEqual(['XAF', 'XAF', 'XAF', 'EUR']);
  });
  it('le serveur applique la même règle (même résultat pour les mêmes saisies)', () => {
    for (const typed of ['', 'FCFA', 'fcfa', 'xaf', 'eur']) {
      expect(Commission.of({ type: 'FIXED', value: '10', currency: typed }).currency).toBe(normalizeCurrency(typed));
    }
  });
});

describe('affichage de la commission', () => {
  it('pourcentage et montant fixe, format français', () => {
    expect(formatCommission({ type: 'PERCENT', value: '7.50', currency: null }).replace(/\s/g, ' ')).toBe('7,50 %');
    expect(formatCommission({ type: 'FIXED', value: '1500.00', currency: 'XAF' }).replace(/\s/g, ' ')).toBe('1 500,00 FCFA');
    expect(formatCommission({ type: 'FIXED', value: '20.00', currency: 'EUR' }).replace(/\s/g, ' ')).toBe('20,00 EUR');
  });
});

describe('interface : la commission et le facilitateur ne se montrent que si les droits les accordent', () => {
  const dialog = read('components/companies/company-dialog.tsx');
  const panel = read('components/companies/facilitation-panel.tsx');
  const detail = read('app/(app)/companies/[id]/page.tsx');
  const list = read('app/(app)/companies/page.tsx');
  it('la fenêtre filtre les choix selon les permissions du profil', () => {
    expect(dialog).toContain("can(profile, 'bd.commission.manage')");
    expect(dialog).toContain("can(profile, 'bd.facilitator.read')");
    expect(dialog).toContain("can(profile, 'bd.facilitator.create')");
    expect(dialog).toContain('canSetCommission ?');
  });
  it('accessibilité : champs groupés (fieldset/legend), obligatoires annoncés, erreurs en role="alert"', () => {
    expect(dialog).toContain('<fieldset>');
    expect(dialog).toContain('<legend>');
    expect(dialog.match(/aria-required="true"/g)!.length).toBeGreaterThanOrEqual(4);
    expect(dialog).toContain('role="alert"');
    expect(dialog).toContain('size="wide"');
  });
  it('le panneau n\'affiche la commission que si l\'API l\'a envoyée (clé absente ≠ « Aucune »)', () => {
    expect(panel).toContain('commission !== undefined');
    expect(panel).toContain('Non visible avec vos droits');
  });
  it('la fiche et la liste utilisent les nouveaux composants', () => {
    expect(detail).toContain('<FacilitationPanel facilitation={company.facilitation} />');
    expect(list).toContain('<CompanyDialog');
    expect(list).not.toContain('function CompanyDialog');
  });
});
