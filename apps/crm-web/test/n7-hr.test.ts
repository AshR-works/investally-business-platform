import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'employé valide les mêmes saisies.
import { Employee } from '../../crm-api/src/modules/hr/domain/employee';
import { entityHref } from '../lib/entity-links';
import {
  buildEmployeeBody, buildOrgTree, countNodes, type DirectoryEntry, departmentsOf, EMPLOYEE_STATE_FILTERS, type Employee as EmployeeView, type EmployeeForm, employeeActions,
  EMPTY_EMPLOYEE_FORM, formFromEmployee, fullName, validateEmployeeFields, validateLeave,
} from '../lib/hr';
import { activeModule, availableModules, byDomain, MODULES } from '../lib/modules';
import { can, canAll } from '../lib/permissions';
import type { Profile } from '../lib/types';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const profileWith = (...grants: [string, string][]) => ({ permissions: grants.map(([code, scope]) => ({ code, scope })) }) as unknown as Profile;
const now = new Date('2026-11-09T10:00:00Z');
const form = (patch: Partial<EmployeeForm> = {}): EmployeeForm => ({
  matricule: 'inv-1', lastName: 'Ndzana', firstName: 'Claire', jobTitle: 'Chargée de compte', department: 'Commercial', managerEmployeeId: '', userId: '',
  workEmail: 'claire@investally.test', workPhone: '+237 699 00 11 22', hiredOn: '2026-03-02', ...patch,
});
const serverAccepts = (f: EmployeeForm): boolean => {
  try {
    Employee.register({ id: 'x', matricule: f.matricule, lastName: f.lastName, firstName: f.firstName, jobTitle: f.jobTitle, department: f.department, workEmail: f.workEmail, workPhone: f.workPhone, hiredOn: f.hiredOn, now });
    return true;
  } catch {
    return false;
  }
};
const entry = (id: string, lastName: string, managerEmployeeId: string | null = null, department = 'Commercial'): DirectoryEntry => ({
  id, firstName: 'A', lastName, jobTitle: 'Poste', department, managerEmployeeId, workEmail: null, workPhone: null,
});

describe('saisie d’une fiche : mêmes règles que le serveur', () => {
  const CASES: [string, Partial<EmployeeForm>][] = [
    ['fiche complète', {}],
    ['sans facultatifs', { matricule: '', workEmail: '', workPhone: '' }],
    ['nom vide', { lastName: '  ' }],
    ['prénom vide', { firstName: '' }],
    ['poste vide', { jobTitle: '' }],
    ['service vide', { department: ' ' }],
    ['nom trop long', { lastName: 'x'.repeat(101) }],
    ['poste trop long', { jobTitle: 'x'.repeat(151) }],
    ['service trop long', { department: 'x'.repeat(101) }],
    ['matricule avec espace', { matricule: 'a b' }],
    ['matricule trop long', { matricule: 'x'.repeat(31) }],
    ['matricule commençant par un tiret', { matricule: '-x' }],
    ['matricule libre valide', { matricule: 'a.b-1/2_3' }],
    ['e-mail invalide', { workEmail: 'pas-un-email' }],
    ['téléphone invalide', { workPhone: 'abc' }],
    ['date irréelle', { hiredOn: '2026-02-31' }],
    ['date absente', { hiredOn: '' }],
    ['date future (admise : une arrivée se prépare)', { hiredOn: '2027-01-04' }],
  ];
  it.each(CASES)('%s', (_, patch) => {
    const f = form(patch);
    expect(Object.keys(validateEmployeeFields(f)).length === 0).toBe(serverAccepts(f));
  });

  it('le corps de création omet les facultatifs vides ; celui de modification les efface et retire responsable et compte avec null', () => {
    const create = buildEmployeeBody(form({ matricule: '', workEmail: '', workPhone: '', managerEmployeeId: 'm1', userId: '' }));
    expect(create).toEqual({ lastName: 'Ndzana', firstName: 'Claire', jobTitle: 'Chargée de compte', department: 'Commercial', hiredOn: '2026-03-02', managerEmployeeId: 'm1' });
    const edit = buildEmployeeBody(form({ matricule: '', workEmail: '', managerEmployeeId: '', userId: '' }), { version: 3 });
    expect(edit).toMatchObject({ version: 3, matricule: '', workEmail: '', managerEmployeeId: null, userId: null });
  });

  it('aucune donnée sensible n’est saisissable ni envoyée : ni champ, ni clé de corps', () => {
    const keys = [...Object.keys(EMPTY_EMPLOYEE_FORM()), ...Object.keys(buildEmployeeBody(form(), { version: 1 }))].join(' ').toLowerCase();
    for (const sensitive of ['salary', 'salaire', 'birth', 'naissance', 'address', 'adresse', 'passport', 'identity', 'health', 'sante']) expect(keys).not.toContain(sensitive);
  });

  it('formFromEmployee reprend la fiche pour la modifier', () => {
    const e = { id: 'e1', matricule: null, lastName: 'N', firstName: 'C', jobTitle: 'P', department: 'S', managerEmployeeId: null, userId: 'u1', workEmail: null, workPhone: null, hiredOn: '2026-03-02' } as unknown as EmployeeView;
    expect(formFromEmployee(e)).toMatchObject({ matricule: '', managerEmployeeId: '', userId: 'u1', workEmail: '', hiredOn: '2026-03-02' });
  });
});

describe('sortie du personnel', () => {
  it('date réelle, pas avant l’entrée ; motif de 500 caractères au plus', () => {
    expect(validateLeave({ leftOn: '2026-11-30', reason: '' }, '2026-03-02')).toEqual({});
    expect(validateLeave({ leftOn: '2026-03-02', reason: '' }, '2026-03-02')).toEqual({});
    expect(validateLeave({ leftOn: '', reason: '' }, '2026-03-02').leftOn).toMatch(/obligatoire/);
    expect(validateLeave({ leftOn: '2026-13-01', reason: '' }, '2026-03-02').leftOn).toMatch(/valide/);
    expect(validateLeave({ leftOn: '2026-03-01', reason: '' }, '2026-03-02').leftOn).toMatch(/précéder/);
    expect(validateLeave({ leftOn: '2026-11-30', reason: 'x'.repeat(501) }, '2026-03-02').reason).toMatch(/500/);
  });
  it('un employé en poste se modifie et sort ; un sorti est gelé et ne peut que revenir ; sans droit, rien', () => {
    expect(employeeActions({ status: 'ACTIVE' }, { update: true, archive: true })).toEqual(['edit', 'archive']);
    expect(employeeActions({ status: 'ARCHIVED' }, { update: true, archive: true })).toEqual(['reactivate']);
    expect(employeeActions({ status: 'ACTIVE' }, { update: false, archive: false })).toEqual([]);
    expect(employeeActions({ status: 'ARCHIVED' }, { update: true, archive: false })).toEqual([]);
    expect(EMPLOYEE_STATE_FILTERS.map((f) => f.value)).toEqual(['ACTIVE', 'ARCHIVED', '']);
  });
  it('jamais de suppression : ni action, ni requête DELETE', () => {
    const all = [...employeeActions({ status: 'ACTIVE' }, { update: true, archive: true }), ...employeeActions({ status: 'ARCHIVED' }, { update: true, archive: true })];
    expect(all.some((a) => /delete|remove|supprim/i.test(a))).toBe(false);
    for (const f of ['app/(app)/hr/employees/page.tsx', 'components/hr/employee-dialog.tsx', 'components/hr/employee-status-dialog.tsx']) expect(read(f)).not.toMatch(/method: 'DELETE'|Supprimer/);
  });
});

describe('organigramme', () => {
  it('range les collaborateurs sous leur responsable, tri par nom, et compte tout le monde', () => {
    const tree = buildOrgTree([entry('c', 'Zola', 'a'), entry('a', 'Boss'), entry('b', 'Atangana', 'a'), entry('d', 'Dupont', 'b')]);
    expect(tree.map((n) => n.entry.id)).toEqual(['a']);
    expect(tree[0]!.reports.map((n) => n.entry.id)).toEqual(['b', 'c']);
    expect(tree[0]!.reports[0]!.reports.map((n) => n.entry.id)).toEqual(['d']);
    expect(countNodes(tree)).toBe(4);
  });
  it('personne n’est perdu : un responsable absent de la liste (sorti, hors périmètre) fait de la personne une racine', () => {
    const tree = buildOrgTree([entry('a', 'Boss'), entry('b', 'Orphelin', 'sorti'), entry('c', 'Autre')]);
    expect(tree.map((n) => n.entry.id)).toEqual(['c', 'a', 'b']); // tri par nom : Autre, Boss, Orphelin
    expect(countNodes(tree)).toBe(3);
  });
  it('une boucle (que le serveur refuse) ne fait jamais disparaître ni tourner l’affichage', () => {
    const tree = buildOrgTree([entry('a', 'A', 'b'), entry('b', 'B', 'a'), entry('c', 'C', 'c')]);
    expect(countNodes(tree)).toBe(3);
  });
  it('liste les services distincts, triés', () => {
    expect(departmentsOf([entry('a', 'A', null, 'Investudy'), entry('b', 'B', null, 'Commercial'), entry('c', 'C', null, 'Investudy')])).toEqual(['Commercial', 'Investudy']);
    expect(fullName({ firstName: 'Claire', lastName: 'Ndzana' })).toBe('Claire Ndzana');
  });
});

describe('menu Ressources humaines', () => {
  it('Annuaire et Organigramme pour tout utilisateur de l’annuaire ; Personnel seulement en portée Tous', () => {
    const everyone = profileWith(['hr.directory.read', 'ALL'], ['hr.employee.read', 'OWN']);
    expect(availableModules(everyone).filter((m) => m.group === 'Ressources humaines').map((m) => m.id)).toEqual(['directory', 'org-chart']);
    const hr = profileWith(['hr.directory.read', 'ALL'], ['hr.employee.read', 'ALL']);
    expect(availableModules(hr).filter((m) => m.group === 'Ressources humaines').map((m) => m.id)).toEqual(['directory', 'org-chart', 'staff']);
    expect(byDomain(availableModules(profileWith())).map((d) => d.domain)).toEqual([]);
    expect(canAll(hr, 'hr.employee.read')).toBe(true);
    expect(canAll(everyone, 'hr.employee.read')).toBe(false);
    expect(can(everyone, 'hr.employee.read')).toBe(true);
  });
  it('le module n’est plus « à venir » ; trois adresses distinctes, la plus précise allume son entrée', () => {
    expect(MODULES.filter((m) => m.group === 'Ressources humaines' && !m.href)).toEqual([]);
    const modules = availableModules(profileWith(['hr.directory.read', 'ALL'], ['hr.employee.read', 'ALL']));
    expect(activeModule(modules, '/hr')?.id).toBe('directory');
    expect(activeModule(modules, '/hr/org-chart')?.id).toBe('org-chart');
    expect(activeModule(modules, '/hr/employees')?.id).toBe('staff');
    expect(activeModule(modules, '/hr/employees/0198a1b2-0000-7000-8000-000000000001')?.id).toBe('staff');
    expect(entityHref('employee', 'x')).toBe('/hr/employees/x');
  });
});

describe('pages', () => {
  it('l’annuaire et l’organigramme lisent l’API restreinte et n’écrivent rien', () => {
    const dir = read('app/(app)/hr/page.tsx');
    expect(dir).toContain("can(profile, 'hr.directory.read')");
    expect(dir).toContain('/hr/directory?');
    expect(dir).not.toMatch(/method: '(POST|PUT|PATCH|DELETE)'/);
    const chart = read('app/(app)/hr/org-chart/page.tsx');
    expect(chart).toContain("'/hr/org-chart'");
    expect(chart).toContain('<details');
    expect(chart).toContain('aria-label="Organigramme du personnel"');
    expect(chart).not.toMatch(/method: '(POST|PUT|PATCH|DELETE)'/);
  });
  it('le personnel : droits de création, modification et archivage lus, filtres par état et service, écarts signalés pour la portée Tous', () => {
    const page = read('app/(app)/hr/employees/page.tsx');
    for (const p of ['hr.employee.read', 'hr.employee.create', 'hr.employee.update', 'hr.employee.archive']) expect(page).toContain(`'${p}'`);
    expect(page).toContain("canAll(profile, 'hr.employee.read')");
    expect(page).toContain("'/hr/employees/hierarchy-gaps'");
    expect(page).toContain("params.set('status', state)");
    expect(page).toContain('jamais</strong> modifiée');
    expect(page).toContain('<EntityLink kind="employee"');
  });
  it('la fiche utilise la coque commune, signale que sa lecture est tracée et ne montre aucune donnée sensible', () => {
    const sheet = read('app/(app)/hr/employees/[id]/page.tsx');
    expect(sheet).toContain("useEntity<Employee>('hr/employees')");
    expect(sheet).toContain('<SheetState kind="employee"');
    expect(sheet).toContain('est enregistrée');
    expect(sheet.toLowerCase()).not.toMatch(/salaire|naissance|adresse personnelle/);
  });
  it('les fenêtres : version lue, responsable et compte proposés, rappel que rien de sensible n’est saisi, sortie réversible', () => {
    const dialog = read('components/hr/employee-dialog.tsx');
    expect(dialog).toContain("'/hr/linkable-users'");
    expect(dialog).toContain('version: employee.version');
    expect(dialog).toContain('Seules les informations professionnelles');
    const status = read('components/hr/employee-status-dialog.tsx');
    expect(status).toContain('/hr/employees/${employee.id}/status');
    expect(status).toContain('vous pourrez la réintégrer');
    expect(status).toContain('Rien n’est supprimé');
  });
});
