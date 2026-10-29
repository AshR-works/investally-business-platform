import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCompanyUpdateBody, editCapabilities, EMPTY_COMPANY_FORM, formFromCompany, validateCompanyFields, type CompanyForm } from '../lib/facilitation';
import type { Company, Facilitation } from '../lib/types';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const facilitator = { id: 'f-1', lastName: 'Mbarga', firstName: 'Paul', phone: '+237 699 00 11 22', comment: null, createdAt: '2026-10-28T09:00:00.000Z' };
const link = (patch: Partial<Facilitation> = {}): Facilitation => ({
  facilitatorId: 'f-1', contactMethod: 'EMAIL', isCompanyEmployee: false, facilitator, commission: { type: 'PERCENT', value: '7.50', currency: null }, ...patch,
});
const company = (patch: Partial<Company> = {}): Company => ({
  id: 'c-1', name: 'Acme', status: 'TARGET', sector: 'Banque', country: 'Cameroun', email: 'a@acme.cm', phone: '+237 222 33 44 55',
  createdAt: '2026-10-28T09:00:00.000Z', version: 3, facilitation: link(), ...patch,
});
const caps = (manage = true, locked = false) => ({ facilitationLocked: locked, canSetCommission: manage });

describe('modifier une fiche — formulaire prérempli', () => {
  it('reprend tous les champs de la fiche, facilitateur et commission compris', () => {
    const form = formFromCompany(company());
    expect(form).toMatchObject({
      name: 'Acme', sector: 'Banque', country: 'Cameroun', email: 'a@acme.cm', phone: '+237 222 33 44 55',
      facilitatorMode: 'existing', facilitatorId: 'f-1', contactMethod: 'EMAIL', commissionType: 'PERCENT', commissionValue: '7.50',
    });
  });
  it('champs absents : vides ; sans facilitateur : « Aucun facilitateur »', () => {
    const form = formFromCompany(company({ sector: null, country: null, email: null, phone: null, facilitation: null }));
    expect(form).toMatchObject({ sector: '', country: '', email: '', phone: '', facilitatorMode: 'none', commissionType: '' });
  });
  it('commission invisible (clé absente) : champs de commission vides, rien n\'est supposé', () => {
    const { commission: _hidden, ...withoutCommission } = link();
    void _hidden;
    expect(formFromCompany(company({ facilitation: withoutCommission })).commissionType).toBe('');
  });
  it('la fiche préremplie est valide telle quelle', () => {
    expect(validateCompanyFields(formFromCompany(company()))).toEqual({});
  });
});

describe('modifier une fiche — droits d\'édition déduits de ce que l\'API a fourni', () => {
  it('commission modifiable : droit de gestion ET commission lisible', () => {
    expect(editCapabilities(company(), true)).toEqual({ facilitationLocked: false, canSetCommission: true });
    expect(editCapabilities(company(), false)).toEqual({ facilitationLocked: false, canSetCommission: false });
    const { commission: _c, ...hidden } = link();
    void _c;
    expect(editCapabilities(company({ facilitation: hidden }), true).canSetCommission).toBe(false);
  });
  it('sans facilitateur, le droit de gestion suffit (on peut en lier un avec commission)', () => {
    expect(editCapabilities(company({ facilitation: null }), true).canSetCommission).toBe(true);
  });
  it('facilitateur non visible : la mise en relation est verrouillée', () => {
    expect(editCapabilities(company({ facilitation: link({ facilitator: null }) }), true).facilitationLocked).toBe(true);
  });
});

describe('modifier une fiche — corps de la requête', () => {
  const edit = (patch: Partial<CompanyForm> = {}, c = company()) => ({ ...formFromCompany(c), ...patch });

  it('toujours la version lue ; une zone vidée est envoyée vide pour être effacée ; jamais de propriétaire ni de statut', () => {
    const body = buildCompanyUpdateBody(edit({ sector: '', phone: '  ' }), company(), caps());
    expect(body).toMatchObject({ version: 3, name: 'Acme', sector: '', phone: '', country: 'Cameroun' });
    expect(JSON.stringify(body)).not.toMatch(/owner|status/i);
  });
  it('facilitateur inchangé : seuls la méthode et l\'appartenance sont envoyés (pas d\'identifiant)', () => {
    const body = buildCompanyUpdateBody(edit({ contactMethod: 'MEETING' }), company(), caps()) as { facilitation: Record<string, unknown> };
    expect(body.facilitation).toMatchObject({ contactMethod: 'MEETING', isCompanyEmployee: false });
    expect(body.facilitation).not.toHaveProperty('facilitatorId');
    expect(body.facilitation).not.toHaveProperty('newFacilitator');
  });
  it('autre facilitateur choisi : son identifiant est envoyé', () => {
    const body = buildCompanyUpdateBody(edit({ facilitatorId: 'f-9' }), company(), caps()) as { facilitation: Record<string, unknown> };
    expect(body.facilitation.facilitatorId).toBe('f-9');
  });
  it('nouveau facilitateur : ses champs sont envoyés, sans identifiant', () => {
    const body = buildCompanyUpdateBody(edit({ facilitatorMode: 'new', facilitatorLastName: 'Eto', facilitatorFirstName: 'Anne', facilitatorPhone: '+237 677 00 11 22' }), company(), caps()) as { facilitation: Record<string, unknown> };
    expect(body.facilitation.newFacilitator).toEqual({ lastName: 'Eto', firstName: 'Anne', phone: '+237 677 00 11 22' });
    expect(body.facilitation).not.toHaveProperty('facilitatorId');
  });
  it('« Aucun facilitateur » : le lien est retiré (null) seulement s\'il existait', () => {
    expect((buildCompanyUpdateBody(edit({ facilitatorMode: 'none' }), company(), caps()) as { facilitation: unknown }).facilitation).toBeNull();
    const without = company({ facilitation: null });
    expect(buildCompanyUpdateBody(edit({}, without), without, caps())).not.toHaveProperty('facilitation');
  });
  it('mise en relation verrouillée : aucune clé « facilitation » n\'est envoyée, même si le formulaire a changé', () => {
    const locked = company({ facilitation: link({ facilitator: null }) });
    expect(buildCompanyUpdateBody(edit({ contactMethod: 'MEETING' }, locked), locked, caps(true, true))).not.toHaveProperty('facilitation');
  });
  it('commission : envoyée par qui peut la gérer (montant fixe avec devise normalisée), retirée (null) si on choisit « Aucune »', () => {
    const fixed = buildCompanyUpdateBody(edit({ commissionType: 'FIXED', commissionValue: '1500,5', commissionCurrency: 'fcfa' }), company(), caps()) as { facilitation: { commission: unknown } };
    expect(fixed.facilitation.commission).toEqual({ type: 'FIXED', value: '1500.5', currency: 'XAF' });
    const removed = buildCompanyUpdateBody(edit({ commissionType: '' }), company(), caps()) as { facilitation: { commission: unknown } };
    expect(removed.facilitation.commission).toBeNull();
  });
  it('sans droit de gestion de la commission : AUCUNE clé « commission » n\'est envoyée (elle est conservée, jamais effacée)', () => {
    const body = buildCompanyUpdateBody(edit({ commissionType: '', contactMethod: 'MEETING' }), company(), caps(false)) as { facilitation: Record<string, unknown> };
    expect(body.facilitation).not.toHaveProperty('commission');
  });
  it('aucune commission à retirer : on n\'envoie pas « null » pour rien', () => {
    const noCommission = company({ facilitation: link({ commission: null }) });
    const body = buildCompanyUpdateBody(edit({ commissionType: '' }, noCommission), noCommission, caps()) as { facilitation: Record<string, unknown> };
    expect(body.facilitation).not.toHaveProperty('commission');
  });
});

describe('interface — boutons « Modifier » et « Exporter la fiche »', () => {
  const page = read('app/(app)/companies/[id]/page.tsx');
  const dialog = read('components/companies/company-dialog.tsx');
  const exporter = read('lib/export-sheet.ts');
  it('« Modifier » n\'apparaît que pour qui a le droit de modification ; la fenêtre reçoit la fiche et recharge à la fin', () => {
    expect(page).toContain("can(profile, 'bd.company.update')");
    expect(page).toContain('<CompanyDialog');
    expect(page).toContain('company={company}');
    expect(page).toMatch(/onDone=\{async \(\) => \{\s*setEditing\(false\);\s*await load\(\);/);
  });
  it('« Exporter la fiche » est proposé à qui voit la fiche, et une erreur est annoncée', () => {
    expect(page).toContain('Exporter la fiche');
    expect(page).toContain('openCompanySheet(id)');
    expect(page).toMatch(/actionError && <p role="alert"/);
  });
  it('la fenêtre fonctionne en création et en modification, avec la version lue envoyée par PUT', () => {
    expect(dialog).toContain("method: 'PUT'");
    expect(dialog).toContain('buildCompanyUpdateBody(form, company, caps)');
    expect(dialog).toContain("company ? 'Modifier l’entreprise' : 'Nouvelle entreprise'");
  });
  it('facilitateur invisible : la mise en relation est remplacée par une note, pas par des champs', () => {
    expect(dialog).toContain('caps.facilitationLocked && (');
    expect(dialog).toContain('!caps.facilitationLocked && (canPickFacilitator || canCreateFacilitator)');
  });
  it('l\'export ouvre la fenêtre AVANT toute attente (sinon le navigateur la bloque), puis la remplit et imprime', () => {
    expect(exporter.indexOf("window.open('', '_blank')")).toBeLessThan(exporter.indexOf('await'));
    expect(exporter).toContain('win.print()');
    expect(exporter).toContain('/export');
    expect(exporter).toMatch(/catch \(error\) \{\s*win\.close\(\);\s*throw error;/);
  });
  it('l\'export ne passe jamais le jeton dans l\'adresse : c\'est le client d\'API (en-tête) qui appelle', () => {
    expect(exporter).toContain("from './api'");
    expect(exporter).not.toMatch(/token|access_token|\?t=/i);
  });
});
