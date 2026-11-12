import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { availableModules, byDomain, MODULES } from '../lib/modules';
import { catalogueHref, CATALOGUE_SECTIONS, sectionFromQuery } from '../lib/catalogue';
import { buildRightsMatrix, countByRole, filterRights, modulesOf, splitPermission } from '../lib/rights';
import type { Profile, RoleView } from '../lib/types';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const profileWith = (...permissions: string[]) => ({ permissions: permissions.map((code) => ({ code, scope: 'ALL' })) }) as unknown as Profile;

describe('catalogue adressable (?rubrique=)', () => {
  const all = CATALOGUE_SECTIONS;
  it('une rubrique connue et lisible s’ouvre directement ; l’adresse est construite à un seul endroit', () => {
    expect(catalogueHref('rooms')).toBe('/training?rubrique=rooms');
    expect(sectionFromQuery('rooms', all)?.id).toBe('rooms');
    expect(sectionFromQuery('trainers', all)?.id).toBe('trainers');
  });
  it('une valeur absente ou inconnue ouvre la première rubrique lisible, jamais autre chose', () => {
    expect(sectionFromQuery(null, all)?.id).toBe('programs');
    expect(sectionFromQuery('n-importe-quoi', all)?.id).toBe('programs');
  });
  it('une rubrique non lisible par le profil n’est pas ouverte par l’adresse', () => {
    const readable = all.filter((s) => s.id !== 'rooms');
    expect(sectionFromQuery('rooms', readable)?.id).toBe('programs');
    expect(sectionFromQuery('rooms', [])).toBeUndefined();
  });
  it('la page lit la rubrique dans l’adresse et la réécrit au changement ; les sessions y renvoient', () => {
    const page = read('app/(app)/training/page.tsx');
    expect(page).toContain("useSearchParams().get('rubrique')");
    expect(page).toContain('router.replace(catalogueHref(v as CatalogueSection))');
    expect(page).not.toContain('setSection(');
    const sessions = read('app/(app)/training/sessions/page.tsx');
    expect(sessions).toContain("catalogueHref('rooms')");
    expect(sessions).toContain("can(profile, 'training.room.read')");
  });
});

const role = (code: string, ...permissions: [string, string][]): RoleView => ({ code, label: code, description: '', mfaRequired: true, permissions: permissions.map(([c, scope]) => ({ code: c, scope })) });
const ROLES = [
  role('AM', ['bd.company.read', 'OWN'], ['bd.company.update', 'OWN']),
  role('CHEF', ['bd.company.read', 'TEAM'], ['bd.ambassador.update', 'TEAM']),
  role('DIR', ['bd.company.read', 'ALL'], ['audit.log.read', 'ALL']),
];

describe('page Droits : matrice en lecture seule', () => {
  it('chaque permission apparaît une fois, avec la portée de chaque rôle qui l’a', () => {
    const rows = buildRightsMatrix(ROLES);
    expect(rows.map((r) => r.code)).toEqual(['audit.log.read', 'bd.ambassador.update', 'bd.company.read', 'bd.company.update']);
    expect(rows.find((r) => r.code === 'bd.company.read')!.scopes).toEqual({ AM: 'OWN', CHEF: 'TEAM', DIR: 'ALL' });
    expect(rows.find((r) => r.code === 'bd.company.update')!.scopes).toEqual({ AM: 'OWN' });
  });
  it('découpe module, ressource, action', () => {
    expect(splitPermission('bd.company.read')).toEqual({ module: 'bd', resource: 'company', action: 'read' });
    expect(splitPermission('x.y.z.update')).toEqual({ module: 'x', resource: 'y.z', action: 'update' });
  });
  it('filtre par domaine et par texte (code ou libellé français), compte les droits d’un rôle', () => {
    const rows = buildRightsMatrix(ROLES);
    expect(filterRights(rows, { module: 'audit', search: '' }).map((r) => r.code)).toEqual(['audit.log.read']);
    expect(filterRights(rows, { module: '', search: 'archiv' })).toEqual([]);
    expect(filterRights(rows, { module: '', search: 'modifier' }).map((r) => r.code)).toEqual(['bd.ambassador.update', 'bd.company.update']);
    expect(filterRights(rows, { module: 'bd', search: ' COMPANY ' })).toHaveLength(2);
    expect(modulesOf(rows)).toEqual(['audit', 'bd']);
    expect(countByRole(rows, 'AM')).toBe(2);
    expect(countByRole(rows, 'DIR')).toBe(2);
  });
  it('est un module d’Administration visible avec iam.role.read seulement', () => {
    const rights = MODULES.find((m) => m.id === 'rights');
    expect(rights).toMatchObject({ group: 'Administration', href: '/admin/rights', permission: 'iam.role.read' });
    expect(byDomain(availableModules(profileWith('iam.role.read'))).flatMap((d) => d.items.map((m) => m.id))).toEqual(['rights']);
    expect(availableModules(profileWith('bd.company.read')).some((m) => m.id === 'rights')).toBe(false);
  });
  it('la page ne modifie rien : aucune écriture, lecture de GET /admin/roles, portée annoncée en texte, légende', () => {
    const page = read('app/(app)/admin/rights/page.tsx');
    expect(page).toContain("api<RoleView[]>('/admin/roles')");
    expect(page).not.toMatch(/method: '(POST|PUT|PATCH|DELETE)'/);
    expect(page).toContain("can(profile, 'iam.role.read')");
    expect(page).toContain('Lecture seule');
    expect(page).toContain('aria-label="Légende des portées"');
    expect(page).toContain('Aucun droit</span>'); // l’absence de droit est dite aux lecteurs d’écran, pas seulement par un tiret
  });
});
