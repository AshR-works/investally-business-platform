import { describe, expect, it } from 'vitest';
import { availableModules, blockingModule, isModuleReleased, MODULES, pageModule, upcomingModules } from '../lib/modules';
import { can, canAll, domainOf, isReleased } from '../lib/permissions';
import type { Profile } from '../lib/types';

const profile = (codes: string[], released?: string[] | null): Profile => ({
  userId: 'u1', email: 'a@exemple.test', displayName: 'Test', roles: ['DIRECTION'], mfaEnrolled: true,
  permissions: codes.map((code) => ({ code, scope: 'ALL' as const })),
  ...(released === undefined ? {} : { releasedDomains: released }),
});

const ALL_CODES = ['iam.user.read', 'iam.role.read', 'hr.directory.read', 'hr.employee.read', 'bd.company.read', 'bd.contact.read', 'bd.offer.read', 'training.program.read', 'training.session.read', 'bd.commission.read'];

describe('V1 : domaines publiés (interface)', () => {
  it('le domaine d’une permission est son premier segment', () => {
    expect(domainOf('bd.company.read')).toBe('bd');
    expect(domainOf('hr.employee.read')).toBe('hr');
    expect(domainOf('')).toBe('');
  });

  it('sans information du serveur, ou avec null, tout est publié', () => {
    expect(isReleased(profile([]), 'bd')).toBe(true);
    expect(isReleased(profile([], null), 'bd')).toBe(true);
    expect(isReleased(null, 'bd')).toBe(true);
  });

  it('avec une liste, seuls ses domaines sont publiés', () => {
    const p = profile([], ['iam', 'hr']);
    expect(isReleased(p, 'iam')).toBe(true);
    expect(isReleased(p, 'hr')).toBe(true);
    expect(isReleased(p, 'bd')).toBe(false);
    expect(isReleased(p, 'training')).toBe(false);
    expect(isReleased(profile([], []), 'iam')).toBe(false);
  });

  it('un droit d’un domaine non publié n’accorde rien à l’interface, un droit publié reste accordé', () => {
    const p = profile(ALL_CODES, ['iam', 'hr']);
    expect(can(p, 'bd.company.read')).toBe(false);
    expect(can(p, 'training.session.read')).toBe(false);
    expect(can(p, 'hr.directory.read')).toBe(true);
    expect(can(p, 'iam.user.read')).toBe(true);
    expect(canAll(p, 'bd.company.read')).toBe(false);
    expect(canAll(p, 'hr.employee.read')).toBe(true);
    // Tout publié : comme avant.
    expect(can(profile(ALL_CODES), 'bd.company.read')).toBe(true);
    expect(can(profile(ALL_CODES, null), 'bd.company.read')).toBe(true);
  });

  it('un droit non détenu reste refusé même si le domaine est publié', () => {
    expect(can(profile(['hr.directory.read'], ['iam', 'hr']), 'hr.employee.read')).toBe(false);
    expect(can(null, 'hr.directory.read')).toBe(false);
  });

  it('les modules du CRM et d’Investudy disparaissent du menu, ceux de la RH et de l’administration restent', () => {
    const labels = availableModules(profile(ALL_CODES, ['iam', 'hr'])).map((m) => m.id);
    expect(labels).toEqual(expect.arrayContaining(['directory', 'org-chart', 'staff', 'users', 'rights']));
    for (const hidden of ['companies', 'contacts', 'offers', 'training', 'sessions', 'commissions']) expect(labels).not.toContain(hidden);
    // Tout publié : le menu complet revient.
    expect(availableModules(profile(ALL_CODES)).map((m) => m.id)).toEqual(expect.arrayContaining(['companies', 'contacts', 'offers', 'training', 'sessions', 'commissions']));
  });

  it('les modules hors version rejoignent « À venir » avec ceux qui ne sont pas construits', () => {
    const upcoming = upcomingModules(profile(ALL_CODES, ['iam', 'hr'])).map((m) => m.id);
    expect(upcoming).toEqual(expect.arrayContaining(['companies', 'offers', 'sessions', 'commissions', 'finance', 'tax', 'stocks', 'reporting']));
    expect(upcoming).not.toContain('directory');
    expect(upcoming).not.toContain('users');
    // Sans profil ou tout publié : seulement les modules non construits.
    const unbuilt = upcomingModules().map((m) => m.id);
    expect(unbuilt).not.toContain('companies');
    expect(unbuilt).toContain('finance');
    expect(upcomingModules(profile(ALL_CODES)).map((m) => m.id)).not.toContain('companies');
  });

  it('un module est publié si son domaine l’est ; un module sans permission l’est toujours', () => {
    const p = profile(ALL_CODES, ['iam', 'hr']);
    const byId = (id: string) => MODULES.find((m) => m.id === id)!;
    expect(isModuleReleased(p, byId('companies'))).toBe(false);
    expect(isModuleReleased(p, byId('staff'))).toBe(true);
    expect(isModuleReleased(p, { ...byId('companies'), permission: undefined })).toBe(true);
  });

  it('trouve le module d’une adresse, y compris une fiche, et aucun pour le compte ou la vue d’ensemble', () => {
    expect(pageModule('/companies')?.id).toBe('companies');
    expect(pageModule('/companies/abc-123')?.id).toBe('companies');
    expect(pageModule('/training/sessions/xyz')?.id).toBe('sessions');
    expect(pageModule('/training')?.id).toBe('training');
    expect(pageModule('/hr/org-chart')?.id).toBe('org-chart');
    expect(pageModule('/account')).toBeNull();
    expect(pageModule('/account/sessions')).toBeNull();
    expect(pageModule('/')).toBeNull();
  });

  it('la page générique remplace l’écran d’un module non publié, et seulement lui', () => {
    const p = profile(ALL_CODES, ['iam', 'hr']);
    expect(blockingModule(p, '/companies')?.id).toBe('companies');
    expect(blockingModule(p, '/companies/abc-123')?.id).toBe('companies');
    expect(blockingModule(p, '/training/sessions')?.id).toBe('sessions');
    expect(blockingModule(p, '/commissions')?.id).toBe('commissions');
    expect(blockingModule(p, '/hr')).toBeNull();
    expect(blockingModule(p, '/hr/employees/e1')).toBeNull();
    expect(blockingModule(p, '/admin/users')).toBeNull();
    expect(blockingModule(p, '/account')).toBeNull();
    expect(blockingModule(p, '/')).toBeNull();
    // Tout publié, ou profil sans information : rien n'est bloqué.
    expect(blockingModule(profile(ALL_CODES), '/companies')).toBeNull();
    expect(blockingModule(profile(ALL_CODES, null), '/companies')).toBeNull();
    expect(blockingModule(null, '/companies')).toBeNull();
  });

  it('chaque module livré a une permission dont le domaine est publiable : aucun écran n’échappe au drapeau', () => {
    const known = ['iam', 'audit', 'docs', 'bd', 'hr', 'training', 'reporting'];
    for (const m of MODULES.filter((x) => x.href)) {
      expect(m.permission, `${m.id} doit déclarer une permission`).toBeTruthy();
      expect(known, `${m.id} : domaine « ${domainOf(m.permission!)} » inconnu du serveur`).toContain(domainOf(m.permission!));
    }
  });
});
