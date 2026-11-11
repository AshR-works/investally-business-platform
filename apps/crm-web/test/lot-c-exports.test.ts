import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : les noms et en-têtes RÉELS de l'API sont interrogés.
import { ADMIN_EXPORT_HEADERS, ADMIN_EXPORT_KINDS, DEFAULT_SESSION_DAYS, MAX_SESSION_DAYS } from '../../crm-api/src/modules/iam/application/admin/admin-export-spec';
import { RESOURCES } from '../../crm-api/src/modules/iam/domain/permission-catalog';
import { RoleCode, resolveGrants } from '../../crm-api/src/modules/iam/domain/roles';
import { DEFAULT_PERIOD, EXPORTS, exportFileName, exportPath, PERIODS, validPeriod } from '../lib/exports';
import { availableModules } from '../lib/modules';
import { RESOURCE_LABELS } from '../lib/roles';
import type { Profile } from '../lib/types';

const profileOf = (role: RoleCode) => ({ permissions: resolveGrants(role).map((g) => ({ code: g.permission, scope: g.scope })) }) as unknown as Profile;

describe('exports d’administration : l’interface suit le serveur', () => {
  it('propose exactement les exports du serveur, dans le même ordre', () => {
    expect(EXPORTS.map((e) => e.kind)).toEqual([...ADMIN_EXPORT_KINDS]);
  });

  it('décrit chaque colonne du fichier réel : chaque en-tête du serveur apparaît dans la description affichée', () => {
    const normalize = (text: string) => text.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ');
    for (const item of EXPORTS) {
      const shown = normalize(item.columns);
      for (const header of ADMIN_EXPORT_HEADERS[item.kind]) {
        // « Rôles (libellés) » est décrit par « rôles (codes et libellés) » ; « Rôle (libellé) » par « libellé » : on cherche le mot principal.
        const word = normalize(header).split(' ')[0]!;
        expect([item.kind, header, shown.includes(word)]).toEqual([item.kind, header, true]);
      }
    }
  });

  it('les périodes proposées et la période par défaut respectent les bornes du serveur', () => {
    expect(DEFAULT_PERIOD).toBe(DEFAULT_SESSION_DAYS);
    expect(PERIODS.map((p) => p.days)).toContain(DEFAULT_PERIOD);
    expect(Math.max(...PERIODS.map((p) => p.days))).toBe(MAX_SESSION_DAYS);
    for (const p of PERIODS) expect(validPeriod(p.days)).toBe(true);
    expect([...PERIODS].map((p) => p.days)).toEqual([...PERIODS].map((p) => p.days).sort((a, b) => a - b));
  });

  it('une période valide est un entier de 1 à 365', () => {
    for (const ok of [1, 30, 90, 365]) expect(validPeriod(ok)).toBe(true);
    for (const bad of [0, -1, 366, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(validPeriod(bad)).toBe(false);
  });

  it('l’adresse porte la période pour les sessions seulement', () => {
    expect(exportPath('users')).toBe('/admin/exports/users');
    expect(exportPath('rights')).toBe('/admin/exports/rights');
    expect(exportPath('users', 30)).toBe('/admin/exports/users');
    expect(exportPath('sessions')).toBe('/admin/exports/sessions?days=90');
    expect(exportPath('sessions', 30)).toBe('/admin/exports/sessions?days=30');
  });

  it('le nom du fichier est daté à la minute, sans deux-points, et identique à celui que choisit le serveur', () => {
    const now = new Date('2026-11-11T09:05:59Z');
    expect(exportFileName('users', now)).toBe('investally-utilisateurs-2026-11-11_09h05.csv');
    expect(exportFileName('rights', now)).toBe('investally-droits-2026-11-11_09h05.csv');
    expect(exportFileName('sessions', now)).toBe('investally-sessions-2026-11-11_09h05.csv');
    expect(exportFileName('users', now)).not.toContain(':');
  });

  it('l’entrée de menu « Exports » n’est offerte qu’au Super administrateur', () => {
    const idsOf = (role: RoleCode) => availableModules(profileOf(role)).map((m) => m.id);
    expect(idsOf(RoleCode.SuperAdmin)).toContain('exports');
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.SuperAdmin)) expect([role, idsOf(role).includes('exports')]).toEqual([role, false]);
    // Une permission en portée Propre ne suffit pas.
    const own = { permissions: [{ code: 'iam.export.read', scope: 'OWN' }] } as unknown as Profile;
    expect(availableModules(own).map((m) => m.id)).not.toContain('exports');
  });

  it('le libellé de la ressource est celui du catalogue du serveur', () => {
    const resource = RESOURCES.find((r) => r.module === 'iam' && r.resource === 'export')!;
    expect(RESOURCE_LABELS['iam.export']).toBe(resource.label);
    expect(resource.actions).toEqual(['read']);
  });
});
