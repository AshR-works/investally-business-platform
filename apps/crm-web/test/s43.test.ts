import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL du contact valide les mêmes saisies.
import { Contact, ContactRole } from '../../crm-api/src/modules/business-development/domain/contact';
import { buildContactBody, CONTACT_ROLES, contactRoleLabel, EMPTY_CONTACT_FORM, formFromContact, isDuplicateConflict, validateContactFields, type ContactForm } from '../lib/contacts';
import { MODULES, availableModules } from '../lib/modules';
import type { Contact as ContactView, Profile } from '../lib/types';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const form = (patch: Partial<ContactForm> = {}): ContactForm => ({ ...EMPTY_CONTACT_FORM, companyId: 'c-1', lastName: 'Fotso', firstName: 'Alain', ...patch });
const view = (patch: Partial<ContactView> = {}): ContactView => ({
  id: 'k-1', companyId: 'c-1', companyName: 'Atlas', lastName: 'Fotso', firstName: 'Alain', role: 'FINANCE_DIRECTOR', email: 'a@atlas.cm', phone: '+237 699 00 11 22', createdAt: '2026-10-30T09:00:00.000Z', version: 4, ...patch,
});
const serverAccepts = (f: ContactForm): boolean => {
  try {
    Contact.register({ id: 'x', companyId: f.companyId, lastName: f.lastName, firstName: f.firstName, role: f.role, email: f.email, phone: f.phone, now: new Date() });
    return true;
  } catch {
    return false;
  }
};

describe('contacts — fonctions', () => {
  it("l'interface propose exactement les fonctions du serveur, en français", () => {
    expect(CONTACT_ROLES.map((r) => r.value).sort()).toEqual(Object.values(ContactRole).sort());
    expect(CONTACT_ROLES.map((r) => r.label)).toEqual(['DAF', 'Décideur', 'Autre']);
    expect(contactRoleLabel('FINANCE_DIRECTOR')).toBe('DAF');
    expect(contactRoleLabel('INCONNUE')).toBe('INCONNUE');
  });
});

describe('contacts — contrôles de saisie identiques à ceux du serveur', () => {
  it.each([
    [{}, true], [{ lastName: '' }, false], [{ firstName: '   ' }, false], [{ email: 'pas-un-mail' }, false], [{ email: 'a@b.cm' }, true],
    [{ phone: 'abc' }, false], [{ phone: '12' }, false], [{ phone: '+237 699 00 11 22' }, true], [{ role: 'PATRON' }, false], [{ lastName: 'x'.repeat(101) }, false],
  ] as const)('%j → valide : %s', (patch, valid) => {
    const f = form(patch);
    // « PATRON » : le formulaire n'a qu'une liste fermée, seul le serveur le refuse ; les autres règles sont les mêmes des deux côtés.
    if (!('role' in patch)) expect(Object.keys(validateContactFields(f)).length === 0).toBe(valid);
    expect(serverAccepts(f)).toBe(valid);
  });
  it("l'entreprise est obligatoire à la création, champ par champ dans l'ordre de la page", () => {
    expect(Object.keys(validateContactFields(form({ companyId: '', lastName: '', email: 'x' })))).toEqual(['companyId', 'lastName', 'email']);
  });
});

describe('contacts — corps des requêtes', () => {
  it('création : entreprise incluse, champs facultatifs vides omis, espaces retirés', () => {
    expect(buildContactBody(form({ lastName: ' Fotso ', email: '', phone: ' ' }))).toEqual({ companyId: 'c-1', lastName: 'Fotso', firstName: 'Alain', role: 'OTHER' });
  });
  it("modification : la version lue, jamais l'entreprise ; une zone vidée est envoyée vide pour être effacée", () => {
    const body = buildContactBody(formFromContact(view({ phone: null })), { version: 4 });
    expect(body).toMatchObject({ version: 4, phone: '', email: 'a@atlas.cm', role: 'FINANCE_DIRECTOR' });
    expect(body).not.toHaveProperty('companyId');
  });
  it("« créer quand même » n'est envoyé qu'après avertissement ; jamais de propriétaire", () => {
    expect(buildContactBody(form())).not.toHaveProperty('allowDuplicate');
    expect(buildContactBody(form(), { allowDuplicate: true })).toHaveProperty('allowDuplicate', true);
    expect(JSON.stringify(buildContactBody(form(), { allowDuplicate: true }))).not.toMatch(/owner/i);
  });
  it('formulaire prérempli depuis le contact', () => {
    expect(formFromContact(view({ email: null }))).toEqual({ companyId: 'c-1', lastName: 'Fotso', firstName: 'Alain', role: 'FINANCE_DIRECTOR', email: '', phone: '+237 699 00 11 22' });
  });
});

describe('contacts — doublon ou modification concurrente ?', () => {
  it("seul un conflit « existe déjà » déclenche l'avertissement de doublon", () => {
    expect(isDuplicateConflict(409, 'Un contact « Alain Fotso » existe déjà dans cette entreprise (même nom ou même e-mail)')).toBe(true);
    expect(isDuplicateConflict(409, 'Le contact a été modifié par un autre utilisateur : rechargez-le avant de le modifier')).toBe(false);
    expect(isDuplicateConflict(422, 'existe déjà')).toBe(false);
  });
});

describe('contacts — navigation', () => {
  const profile = (permissions: string[]): Profile => ({ permissions: permissions.map((code) => ({ code, scope: 'OWN' })) } as unknown as Profile);
  it('le module « Contacts » apparaît pour qui peut lire les contacts, et pas pour les autres', () => {
    expect(MODULES.find((m) => m.id === 'contacts')).toMatchObject({ href: '/contacts', permission: 'bd.contact.read' });
    expect(availableModules(profile(['bd.contact.read'])).map((m) => m.id)).toContain('contacts');
    expect(availableModules(profile([])).map((m) => m.id)).not.toContain('contacts');
  });
});

describe('interface — fiche entreprise, fenêtre et page des contacts', () => {
  const panel = read('components/contacts/contacts-panel.tsx');
  const dialog = read('components/contacts/contact-dialog.tsx');
  const page = read('app/(app)/contacts/page.tsx');
  const company = read('app/(app)/companies/[id]/page.tsx');
  it('la fiche affiche les contacts seulement à qui peut les lire', () => {
    expect(company).toContain("can(profile, 'bd.contact.read')");
    expect(company).toContain('<ContactsPanel');
  });
  it("chaque bouton suit sa permission ; la suppression est confirmée", () => {
    expect(panel).toContain("can(profile, 'bd.contact.create')");
    expect(panel).toContain("can(profile, 'bd.contact.update')");
    expect(panel).toContain("can(profile, 'bd.contact.delete')");
    expect(panel).toContain('<ConfirmDialog');
    expect(panel).toContain('Cette action est enregistrée dans l’audit');
  });
  it('la fenêtre : création et modification, doublon avec « Créer quand même », version lue envoyée', () => {
    expect(dialog).toContain("method: 'PUT'");
    expect(dialog).toContain('version: contact.version');
    expect(dialog).toContain('Créer quand même');
    expect(dialog).toContain('isDuplicateConflict(e.status, e.message)');
  });
  it('champs non conformes en surbrillance, relies à leur message, premier champ en erreur au focus (EXD-16)', () => {
    expect(dialog).toContain('fieldProps(PREFIX, name, errors[name])');
    expect(dialog).toContain('Corrigez les champs en surbrillance');
    expect(dialog).toMatch(/getElementById\(`\$\{PREFIX\}-\$\{first\}`\)\?\.focus\(\)/);
    expect(dialog).toContain('aria-required="true"');
    const field = read('components/form-field.tsx');
    expect(field).toContain("'aria-invalid'");
    expect(field).toContain('className="field-error"');
  });
  it('le champ de formulaire est défini hors du rendu (sinon le focus se perd à chaque frappe)', () => {
    expect(dialog).not.toMatch(/const FormField = /);
    expect(dialog).toContain("from '../form-field'");
  });
  it('la fenêtre est large et propose Annuler à côté de l\'action principale', () => {
    expect(dialog).toContain('size="wide"');
    expect(dialog).toContain('>Annuler</button>');
  });
  it('la page liste filtre par fonction, recherche, pagine et garde la sélection persistante', () => {
    expect(page).toContain('SearchField');
    expect(page).toContain("params.set('role', role)");
    expect(page).toContain('<Pagination');
    expect(page).toContain('selection={{ selected, onChange: setSelected }}');
    expect(page).toContain("can(profile, 'bd.contact.create')");
  });
});
