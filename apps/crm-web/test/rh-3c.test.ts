import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adjustBody, adjustFormOf, CONTRACT_PAGES, contractActions, contractBody, daysLeftText, deadlineKindLabel, deadlineTone, EMPTY_CONTRACT_FORM, END_REASONS, validateAdjust,
  validateContractForm, validateDates, validateEnd, validateTypeForm, isIsoDate, type Contract,
} from '../lib/contracts';
import {
  canCancel, emptyRow, JOURNEY_PAGES, launchBody, MAX_TEMPLATE_TASKS, moveRow, offsetText, progressPercent, progressText, rowsOf, rowsValid, taskAction, templateBody, validateLaunch,
  validateRows, type Journey, type TemplateRow,
} from '../lib/journeys';
import { availableModules, MODULES } from '../lib/modules';
import type { Profile } from '../lib/types';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const contract = (patch: Partial<Contract> = {}): Contract => ({
  id: 'c1', employeeId: 'e1', employeeName: 'Sam Test', contractTypeId: 't1', contractTypeLabel: 'CDD', fixedTerm: true, start: '2026-04-01', end: '2026-09-30', probationEnd: '2026-05-01',
  status: 'ACTIVE', endedOn: null, endReason: null, endReasonLabel: null, createdAt: '2026-04-01T00:00:00Z', version: 1, ...patch,
});

describe('RH-3c — contrats : règles de saisie (celles du serveur)', () => {
  it('une date doit exister', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    for (const bad of ['', '2026-02-30', '01/12/2026', '2026-13-01']) expect(isIsoDate(bad)).toBe(false);
  });

  it('durée déterminée : fin obligatoire ; durée indéterminée : fin interdite', () => {
    expect(validateDates({ start: '2026-12-01', end: '', probationEnd: '' }, true).end).toMatch(/obligatoire/);
    expect(validateDates({ start: '2026-12-01', end: '2027-01-01', probationEnd: '' }, false).end).toMatch(/indéterminée/);
    expect(validateDates({ start: '2026-12-01', end: '', probationEnd: '' }, false)).toEqual({});
    expect(validateDates({ start: '2026-12-01', end: '', probationEnd: '' }, null)).toEqual({});
  });

  it('la fin ne précède pas le début (le même jour est permis) ; l’essai reste dans le contrat, bornes comprises', () => {
    expect(validateDates({ start: '2026-12-02', end: '2026-12-01', probationEnd: '' }, true).end).toMatch(/précéder/);
    expect(validateDates({ start: '2026-12-01', end: '2026-12-01', probationEnd: '' }, true)).toEqual({});
    expect(validateDates({ start: '2026-12-01', end: '', probationEnd: '2026-11-30' }, false).probationEnd).toMatch(/précéder/);
    expect(validateDates({ start: '2026-12-01', end: '2027-03-01', probationEnd: '2027-03-02' }, true).probationEnd).toMatch(/dépasser/);
    expect(validateDates({ start: '2026-12-01', end: '2027-03-01', probationEnd: '2027-03-01' }, true)).toEqual({});
  });

  it('les bornes comprises sont acceptées : essai le jour du début, fin effective le jour du début et le jour de la fin prévue', () => {
    expect(validateDates({ start: '2026-12-01', end: '', probationEnd: '2026-12-01' }, false)).toEqual({});
    const c = contract();
    expect(validateEnd({ endedOn: c.start, reason: 'OTHER' }, c)).toEqual({});
    expect(validateEnd({ endedOn: c.end as string, reason: 'OTHER' }, c)).toEqual({});
  });

  it('le formulaire exige l’employé et le type', () => {
    const errors = validateContractForm(EMPTY_CONTRACT_FORM('2026-12-01'), null);
    expect(Object.keys(errors).sort()).toEqual(['contractTypeId', 'employeeId']);
    expect(validateContractForm({ employeeId: 'e', contractTypeId: 't', start: '2026-12-01', end: '', probationEnd: '' }, { fixedTerm: false })).toEqual({});
  });

  it('le corps n’envoie que les dates renseignées', () => {
    expect(contractBody({ employeeId: 'e', contractTypeId: 't', start: '2026-12-01', end: '', probationEnd: '' })).toEqual({ employeeId: 'e', contractTypeId: 't', start: '2026-12-01' });
    expect(contractBody({ employeeId: 'e', contractTypeId: 't', start: '2026-12-01', end: '2027-05-31', probationEnd: '2027-02-28' })).toEqual({ employeeId: 'e', contractTypeId: 't', start: '2026-12-01', end: '2027-05-31', probationEnd: '2027-02-28' });
  });

  it('ajuster : la fin n’est envoyée que pour une durée déterminée, et l’essai vide s’efface', () => {
    const cdd = contract();
    expect(adjustBody({ end: '2026-12-31', probationEnd: '' }, cdd)).toEqual({ version: 1, end: '2026-12-31', probationEnd: null });
    const cdi = contract({ fixedTerm: false, end: null });
    expect(adjustBody(adjustFormOf(cdi), cdi)).toEqual({ version: 1, probationEnd: '2026-05-01' });
    expect(validateAdjust({ end: '2026-03-01', probationEnd: '' }, cdd).end).toMatch(/précéder/);
  });

  it('terminer : date entre le début et la fin prévue, motif dans la liste fermée', () => {
    const c = contract();
    expect(validateEnd({ endedOn: '2026-05-01', reason: 'RESIGNATION' }, c)).toEqual({});
    expect(validateEnd({ endedOn: '2026-03-31', reason: 'OTHER' }, c).endedOn).toMatch(/précéder/);
    expect(validateEnd({ endedOn: '2026-10-01', reason: 'OTHER' }, c).endedOn).toMatch(/prolongez/);
    expect(validateEnd({ endedOn: '', reason: 'OTHER' }, c).endedOn).toBeDefined();
    for (const reason of ['', 'Licenciement', 'resignation']) expect(validateEnd({ endedOn: '2026-05-01', reason }, c).reason).toBeDefined();
    expect(END_REASONS.map((r) => r.code)).toEqual(['FIXED_TERM_END', 'PROBATION_END', 'RESIGNATION', 'MISSION_END', 'OTHER']);
  });

  it('un contrat d’un CDI terminé à une date quelconque est permis', () => {
    expect(validateEnd({ endedOn: '2040-01-01', reason: 'RESIGNATION' }, contract({ end: null, fixedTerm: false }))).toEqual({});
  });

  it('types : code bien formé à la création, libellé et ordre bornés', () => {
    expect(validateTypeForm({ code: 'apprenti', label: 'Apprentissage', fixedTerm: true, sortOrder: '100' }, { creating: true })).toEqual({});
    for (const code of ['', 'A', '1CDI', 'CD-I']) expect(validateTypeForm({ code, label: 'X', fixedTerm: false, sortOrder: '1' }, { creating: true }).code).toBeDefined();
    expect(validateTypeForm({ code: '', label: 'X', fixedTerm: false, sortOrder: '1' }, { creating: false }).code).toBeUndefined();
    expect(validateTypeForm({ code: 'OK', label: '  ', fixedTerm: false, sortOrder: '1' }, { creating: true }).label).toBeDefined();
    for (const sortOrder of ['', '-1', '10001', '1.5', 'a']) expect(validateTypeForm({ code: 'OK', label: 'X', fixedTerm: false, sortOrder }, { creating: true }).sortOrder).toBeDefined();
  });

  it('actions : seulement sur un contrat en cours, pour qui gère', () => {
    expect(contractActions({ status: 'ACTIVE' }, true)).toEqual(['adjust', 'end']);
    expect(contractActions({ status: 'ENDED' }, true)).toEqual([]);
    expect(contractActions({ status: 'ACTIVE' }, false)).toEqual([]);
  });

  it('échéances : teinte selon les jours restants, libellés en clair', () => {
    expect([0, 7, 8, 30, 31].map(deadlineTone)).toEqual(['bad', 'bad', 'warn', 'warn', 'neutral']);
    expect([0, 1, 12].map(daysLeftText)).toEqual(['Aujourd’hui', 'Demain', 'Dans 12 jours']);
    expect(deadlineKindLabel('CONTRACT_END')).toBe('Fin du contrat');
    expect(deadlineKindLabel('PROBATION_END')).toBe('Fin de la période d’essai');
  });
});

const journey = (patch: Partial<Journey> = {}): Journey => ({
  id: 'j1', employeeId: 'e1', employeeName: 'Sam Test', kind: 'ONBOARDING', kindLabel: 'Intégration', referenceDate: '2026-12-01', status: 'ACTIVE', createdAt: '2026-11-10T00:00:00Z', completedAt: null,
  cancelledAt: null, progress: { done: 2, total: 6 }, overdueCount: 0, tasks: [], version: 1, ...patch,
});

describe('RH-3c — parcours : lancement, cases à cocher, modèles', () => {
  it('lancer : employé et nature obligatoires, date de référence valide si elle est donnée', () => {
    expect(Object.keys(validateLaunch({ employeeId: '', kind: '', referenceDate: '' })).sort()).toEqual(['employeeId', 'kind']);
    expect(validateLaunch({ employeeId: 'e', kind: 'AUTRE' as 'ONBOARDING', referenceDate: '' }).kind).toBeDefined();
    expect(validateLaunch({ employeeId: 'e', kind: 'OFFBOARDING', referenceDate: '2026-02-30' }).referenceDate).toBeDefined();
    expect(validateLaunch({ employeeId: 'e', kind: 'OFFBOARDING', referenceDate: '2026-12-31' })).toEqual({});
    expect(launchBody({ employeeId: 'e', kind: 'ONBOARDING', referenceDate: '' })).toEqual({ employeeId: 'e', kind: 'ONBOARDING' });
    expect(launchBody({ employeeId: 'e', kind: 'ONBOARDING', referenceDate: '2026-12-01' })).toEqual({ employeeId: 'e', kind: 'ONBOARDING', referenceDate: '2026-12-01' });
  });

  it('cocher : seulement pour qui gère, sur un parcours en cours ; décocher tant que le parcours n’est pas annulé', () => {
    const open = { done: false };
    const done = { done: true };
    expect(taskAction({ status: 'ACTIVE' }, open, true)).toBe('check');
    expect(taskAction({ status: 'ACTIVE' }, done, true)).toBe('reopen');
    expect(taskAction({ status: 'COMPLETED' }, done, true)).toBe('reopen');
    expect(taskAction({ status: 'COMPLETED' }, open, true)).toBeNull();
    expect(taskAction({ status: 'CANCELLED' }, done, true)).toBeNull();
    expect(taskAction({ status: 'CANCELLED' }, open, true)).toBeNull();
    for (const status of ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const) for (const t of [open, done]) expect(taskAction({ status }, t, false)).toBeNull();
  });

  it('annuler : seulement un parcours en cours, pour qui gère', () => {
    expect(canCancel({ status: 'ACTIVE' }, true)).toBe(true);
    expect(canCancel({ status: 'COMPLETED' }, true)).toBe(false);
    expect(canCancel({ status: 'CANCELLED' }, true)).toBe(false);
    expect(canCancel({ status: 'ACTIVE' }, false)).toBe(false);
  });

  it('avancement en texte et en pourcentage', () => {
    expect(progressText(journey().progress)).toBe('2 sur 6');
    expect([{ done: 0, total: 0 }, { done: 2, total: 6 }, { done: 6, total: 6 }].map(progressPercent)).toEqual([0, 33, 100]);
  });

  it('échéance relative en clair', () => {
    expect(offsetText(0, 'ONBOARDING')).toBe('Le jour de l’entrée');
    expect(offsetText(-3, 'ONBOARDING')).toBe('3 jours avant l’entrée');
    expect(offsetText(1, 'OFFBOARDING')).toBe('1 jour après le départ');
  });

  const row = (title: string, offset = '0'): TemplateRow => ({ key: title, title, owner: 'HR', offset });

  it('modèle : 1 à 30 tâches, titres distincts sans tenir compte de la casse, échéance entière dans ±365', () => {
    expect(validateRows([]).list).toMatch(/au moins une/);
    expect(validateRows(Array.from({ length: MAX_TEMPLATE_TASKS + 1 }, (_, i) => row(`T${i}`))).list).toMatch(/30/);
    expect(rowsValid(Array.from({ length: MAX_TEMPLATE_TASKS }, (_, i) => row(`T${i}`)))).toBe(true);
    expect(validateRows([row('   ')]).rows[0].title).toBeDefined();
    expect(validateRows([row('x'.repeat(151))]).rows[0].title).toMatch(/150/);
    expect(validateRows([row('Badge'), row('BADGE')]).rows[1].title).toMatch(/déjà/);
    for (const offset of ['366', '-366', '1.5', '', 'a']) expect(validateRows([row('A', offset)]).rows[0].offset).toBeDefined();
    expect(rowsValid([row('A', '365'), row('B', '-365')])).toBe(true);
  });

  it('modèle : le corps nettoie les titres et convertit les échéances', () => {
    expect(templateBody([{ key: 'k', title: '  Remettre   le badge ', owner: 'IT', offset: '-3' }], 4)).toEqual({ version: 4, tasks: [{ title: 'Remettre le badge', owner: 'IT', dueOffsetDays: -3 }] });
  });

  it('modèle : réordonner ne mélange pas les lignes et reste dans les bornes', () => {
    const rows = [row('A'), row('B'), row('C')];
    expect(moveRow(rows, 1, -1).map((r) => r.title)).toEqual(['B', 'A', 'C']);
    expect(moveRow(rows, 1, 1).map((r) => r.title)).toEqual(['A', 'C', 'B']);
    expect(moveRow(rows, 0, -1).map((r) => r.title)).toEqual(['A', 'B', 'C']);
    expect(moveRow(rows, 2, 1).map((r) => r.title)).toEqual(['A', 'B', 'C']);
    expect(moveRow(rows, 9, 1).map((r) => r.title)).toEqual(['A', 'B', 'C']);
  });

  it('modèle : les lignes d’un modèle reçu ont des clés uniques, une nouvelle ligne est valide hors titre', () => {
    const rows = rowsOf({ tasks: [{ title: 'A', owner: 'HR', ownerLabel: 'x', dueOffsetDays: 0 }, { title: 'B', owner: 'IT', ownerLabel: 'y', dueOffsetDays: -3 }] });
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    expect(rows[1]).toMatchObject({ title: 'B', owner: 'IT', offset: '-3' });
    expect(emptyRow()).toMatchObject({ title: '', owner: 'HR', offset: '0' });
  });
});

describe('RH-3c — menu et droits', () => {
  const profile = (grants: Record<string, 'OWN' | 'TEAM' | 'ALL'>): Profile => ({
    userId: 'u', email: 'u@x', displayName: 'U', roles: [], permissions: Object.entries(grants).map(([code, scope]) => ({ code, scope })), mfaEnrolled: true,
  });

  it('quatre écrans RH ajoutés au domaine « Ressources humaines », avec leur droit', () => {
    const ids = ['contracts', 'contract-deadlines', 'journeys', 'journey-templates'];
    for (const id of ids) expect(MODULES.find((m) => m.id === id)).toMatchObject({ group: 'Ressources humaines' });
    expect(MODULES.find((m) => m.id === 'contracts')).toMatchObject({ href: '/hr/contracts', permission: 'hr.contract.read' });
    expect(MODULES.find((m) => m.id === 'contract-deadlines')).toMatchObject({ href: '/hr/contracts/deadlines', permission: 'hr.contract.manage', allScope: true });
    expect(MODULES.find((m) => m.id === 'journeys')).toMatchObject({ href: '/hr/journeys', permission: 'hr.journey.read' });
    expect(MODULES.find((m) => m.id === 'journey-templates')).toMatchObject({ href: '/hr/journeys/templates', permission: 'hr.journey.manage', allScope: true });
  });

  it('l’écran des échéances et celui des modèles sont réservés à qui gère en portée Tous', () => {
    expect(CONTRACT_PAGES.find((p) => p.id === 'deadlines')).toMatchObject({ permission: 'hr.contract.manage', allScope: true });
    expect(JOURNEY_PAGES.find((p) => p.id === 'templates')).toMatchObject({ permission: 'hr.journey.manage', allScope: true });
  });

  const ids = (p: Profile) => availableModules(p).map((m) => m.id).filter((id) => ['contracts', 'contract-deadlines', 'journeys', 'journey-templates'].includes(id));

  it('un employé voit ses contrats et ses parcours, pas les échéances ni les modèles', () => {
    expect(ids(profile({ 'hr.contract.read': 'OWN', 'hr.journey.read': 'OWN' }))).toEqual(['contracts', 'journeys']);
  });

  it('la Direction lit tout mais n’a ni les échéances ni les modèles à gérer ; la RH a les quatre écrans', () => {
    expect(ids(profile({ 'hr.contract.read': 'ALL', 'hr.journey.read': 'ALL' }))).toEqual(['contracts', 'journeys']);
    expect(ids(profile({ 'hr.contract.read': 'ALL', 'hr.contract.manage': 'ALL', 'hr.journey.read': 'ALL', 'hr.journey.manage': 'ALL' }))).toEqual(['contracts', 'contract-deadlines', 'journeys', 'journey-templates']);
  });

  it('sans droit, aucun de ces écrans', () => {
    expect(ids(profile({}))).toEqual([]);
  });
});

describe('RH-3c — écrans : pas de salaire, pas de texte libre, pas de « Fermer »', () => {
  const files = [
    'app/(app)/hr/contracts/page.tsx', 'app/(app)/hr/contracts/deadlines/page.tsx', 'app/(app)/hr/journeys/page.tsx', 'app/(app)/hr/journeys/[id]/page.tsx',
    'app/(app)/hr/journeys/templates/page.tsx', 'components/hr/contract-dialogs.tsx', 'components/hr/journey-dialogs.tsx', 'lib/contracts.ts', 'lib/journeys.ts',
  ];
  it('aucun champ de rémunération ni de document', () => {
    for (const file of files) expect(read(file), file).not.toMatch(/salary|remuneration|grossPay|type="file"/i);
  });
  it('aucune zone de texte libre dans les contrats ni les parcours (le motif de fin est une liste)', () => {
    for (const file of ['components/hr/contract-dialogs.tsx', 'components/hr/journey-dialogs.tsx', 'app/(app)/hr/journeys/templates/page.tsx']) expect(read(file), file).not.toContain('<textarea');
  });
  it('aucun bouton « Fermer » en bas des fenêtres', () => {
    for (const file of ['components/hr/contract-dialogs.tsx', 'components/hr/journey-dialogs.tsx']) expect(read(file), file).not.toMatch(/>\s*Fermer\s*<\/button>/);
  });
  it('modèles : chaque erreur de ligne est reliée à son champ (aria-describedby) et nommée par un identifiant', () => {
    const source = read('app/(app)/hr/journeys/templates/page.tsx');
    for (const field of ['title', 'offset']) {
      expect(source).toContain('aria-describedby={shown.rows[i]?.' + field + ' ? `${prefix}-' + field + '-${row.key}-error` : undefined}');
      expect(source).toContain('<p id={`${prefix}-' + field + '-${row.key}-error`} className="field-error">');
    }
  });
  it('chaque action d’écriture est réservée à qui gère (le serveur re-contrôle)', () => {
    expect(read('app/(app)/hr/contracts/page.tsx')).toContain("canAll(profile, 'hr.contract.manage')");
    expect(read('app/(app)/hr/journeys/page.tsx')).toContain("canAll(profile, 'hr.journey.manage')");
    expect(read('app/(app)/hr/journeys/[id]/page.tsx')).toContain("canAll(profile, 'hr.journey.manage')");
  });
  it('la liste des motifs de fin est celle du serveur', () => {
    const server = readFileSync(join(root, '..', 'crm-api/src/modules/hr/domain/contract.ts'), 'utf8');
    for (const { code } of END_REASONS) expect(server).toContain(`'${code}'`);
  });
});
