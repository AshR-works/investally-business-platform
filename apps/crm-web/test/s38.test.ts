import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Test de cohérence interface ↔ serveur : on importe la matrice et la règle de décision RÉELLES du serveur (modules purs,
// sans dépendance), uniquement dans ce test.
import { widestScope } from '../../crm-api/src/modules/iam/domain/access-policy';
import { PERMISSIONS, RESOURCES } from '../../crm-api/src/modules/iam/domain/permission-catalog';
import { ROLES, resolveGrants } from '../../crm-api/src/modules/iam/domain/roles';
import {
  ACTION_LABELS, diffRoles, effectiveRights, groupRoles, MODULE_LABELS, mergeGrants, RESOURCE_LABELS, ROLE_GROUPS, sameRoles, selectionSummary,
  toggleRole,
} from '../lib/roles';
import type { RoleView } from '../lib/types';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** Les rôles tels que `GET /admin/roles` les expose, construits depuis la vraie matrice du serveur. */
const serverRoles: RoleView[] = ROLES.map((r) => ({
  code: r.code, label: r.label, description: r.description, mfaRequired: r.mfaRequired,
  permissions: resolveGrants(r.code).map((g) => ({ code: g.permission, scope: g.scope })),
}));
const roleView = (code: string, permissions: { code: string; scope: string }[] = []): RoleView => ({ code, label: code, description: '', mfaRequired: true, permissions });

describe('fusion des droits : l\'interface fait exactement comme le serveur', () => {
  it('pour CHACUNE des 1 024 combinaisons de rôles, même portée pour chaque permission', () => {
    const codes = serverRoles.map((r) => r.code);
    for (let mask = 0; mask < 1 << codes.length; mask++) {
      const chosen = codes.filter((_, i) => mask & (1 << i));
      const grants = chosen.flatMap((code) => resolveGrants(ROLES.find((r) => r.code === code)!.code));
      const client = mergeGrants(serverRoles, chosen);
      const expected = new Map<string, string>();
      for (const p of PERMISSIONS) {
        const scope = widestScope(grants, p.code);
        if (scope) expected.set(p.code, scope);
      }
      expect([chosen.join('+'), [...client].sort()]).toEqual([chosen.join('+'), [...expected].sort()]);
    }
  });
  it('la portée la plus large l\'emporte quand deux rôles accordent la même permission', () => {
    const a = roleView('A', [{ code: 'bd.company.read', scope: 'OWN' }]);
    const b = roleView('B', [{ code: 'bd.company.read', scope: 'ALL' }]);
    const c = roleView('C', [{ code: 'bd.company.read', scope: 'TEAM' }]);
    expect(mergeGrants([a, b, c], ['A', 'C']).get('bd.company.read')).toBe('TEAM');
    expect(mergeGrants([a, b, c], ['A', 'B', 'C']).get('bd.company.read')).toBe('ALL');
    expect(mergeGrants([a, b, c], ['B', 'A']).get('bd.company.read')).toBe('ALL');
  });
  it('aucun rôle choisi : aucun droit', () => {
    expect(effectiveRights(serverRoles, []).permissionCount).toBe(0);
    expect(effectiveRights(serverRoles, []).modules).toEqual([]);
  });
});

describe('aperçu des droits par module', () => {
  it('regroupe par module puis ressource, et compte les permissions sans en perdre', () => {
    const rights = effectiveRights(serverRoles, ['SUPER_ADMIN']);
    expect(rights.permissionCount).toBe(resolveGrants(ROLES.find((r) => r.code === 'SUPER_ADMIN')!.code).length);
    expect(rights.modules.reduce((n, m) => n + m.permissionCount, 0)).toBe(rights.permissionCount);
    expect(rights.modules.map((m) => m.module)).toEqual(['bd', 'training', 'docs', 'reporting', 'audit', 'iam'].filter((m) => rights.modules.some((x) => x.module === m)));
  });
  it('un rôle étroit ne voit pas les modules qu\'il n\'a pas', () => {
    const modules = effectiveRights(serverRoles, ['HR']).modules.map((m) => m.module);
    expect(modules).not.toContain('bd');
  });
  it('libellés : tous les modules, ressources et actions du catalogue du serveur sont traduits (aucun code brut à l\'écran)', () => {
    for (const r of RESOURCES) {
      expect(MODULE_LABELS[r.module], `module ${r.module}`).toBeDefined();
      expect(RESOURCE_LABELS[`${r.module}.${r.resource}`], `ressource ${r.module}.${r.resource}`).toBe(r.label);
      for (const action of r.actions) expect(ACTION_LABELS[action], `action ${action}`).toBeDefined();
    }
  });
});

describe('familles de rôles', () => {
  it('rangent chacun des rôles du serveur dans UNE famille, sans doublon ni oubli', () => {
    const grouped = groupRoles(serverRoles).flatMap((g) => g.roles.map((r) => r.code));
    expect([...grouped].sort()).toEqual(serverRoles.map((r) => r.code).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(groupRoles(serverRoles).map((g) => g.group.id)).not.toContain('autres');
  });
  it('un rôle inconnu tombe dans « Autres rôles » au lieu de disparaître', () => {
    const groups = groupRoles([...serverRoles, roleView('NOUVEAU_ROLE')]);
    expect(groups.at(-1)?.group.id).toBe('autres');
    expect(groups.at(-1)?.roles.map((r) => r.code)).toEqual(['NOUVEAU_ROLE']);
  });
  it('un rôle absent de l\'API n\'est pas affiché ; l\'administration vient en dernier', () => {
    const groups = groupRoles(serverRoles.filter((r) => r.code !== 'TAX'));
    expect(groups.flatMap((g) => g.roles.map((r) => r.code))).not.toContain('TAX');
    expect(groups.at(-1)?.group.id).toBe('administration');
    expect(ROLE_GROUPS.at(-1)?.roles).toEqual(['SUPER_ADMIN']);
  });
});

describe('sélection et changements', () => {
  it('ajouter, retirer, sans modifier la liste d\'origine', () => {
    const origin = ['A', 'B'];
    expect(toggleRole(origin, 'C')).toEqual(['A', 'B', 'C']);
    expect(toggleRole(origin, 'A')).toEqual(['B']);
    expect(origin).toEqual(['A', 'B']);
  });
  it('différences par rapport à l\'état d\'origine, ordre indifférent pour « inchangé »', () => {
    expect(diffRoles(['A', 'B'], ['B', 'C'])).toEqual({ added: ['C'], removed: ['A'] });
    expect(sameRoles(['A', 'B'], ['B', 'A'])).toBe(true);
    expect(sameRoles(['A'], ['A', 'B'])).toBe(false);
  });
  it('phrase du compteur : accords et cas vide', () => {
    expect(selectionSummary(0, 0)).toBe('Aucun rôle sélectionné');
    expect(selectionSummary(1, 1)).toBe('1 rôle sélectionné · 1 permission');
    expect(selectionSummary(3, 41)).toBe('3 rôles sélectionnés · 41 permissions');
  });
});

describe('interface : les deux fenêtres utilisent le sélecteur (UX-02)', () => {
  const page = read('app/(app)/admin/users/page.tsx');
  const picker = read('components/admin/role-picker.tsx');
  const preview = read('components/admin/rights-preview.tsx');
  it('l\'ancienne liste de cases à cocher a disparu', () => {
    expect(page).not.toContain('RoleChoices');
    expect(page.match(/<RolePicker/g)?.length).toBe(2);
  });
  it('les fenêtres sont larges et l\'invitation ne demande pas d\'aperçu séparé', () => {
    expect(page.match(/size="wide"/g)?.length).toBe(2);
    expect(read('components/modal.tsx')).toContain("size === 'wide'");
  });
  it('on ne modifie pas ses propres rôles : sélection bloquée avec explication, enregistrement désactivé', () => {
    expect(page).toContain('isSelf={dialog.user.id === profile?.userId}');
    expect(page).toContain('Vous ne pouvez pas modifier vos propres rôles');
    expect(page).toMatch(/disabled=\{busy \|\| isSelf/);
  });
  it('en mode bloqué, les cases ET « Tout désélectionner » sont désactivées', () => {
    expect(picker.match(/disabled=\{Boolean\(locked\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(picker).toMatch(/<input[\s\S]*?disabled=\{Boolean\(locked\)\}[\s\S]*?onChange/);
  });
  it('« Enregistrer » exige un changement réel et au moins un rôle', () => {
    expect(page).toContain('sameRoles(user.roles, selected)');
    expect(page).toContain('selected.length === 0');
  });
  it('accessibilité : familles en fieldset/legend, compteur annoncé, nom et description reliés, désélection globale', () => {
    expect(picker).toContain('<fieldset');
    expect(picker).toContain('<legend');
    expect(picker).toContain('role="status"');
    expect(picker).toContain('aria-labelledby');
    expect(picker).toContain('aria-describedby');
    expect(picker).toContain('Tout désélectionner');
  });
  it('le rôle à accès complet est signalé, et le texte (pas seulement la couleur) dit « Sera ajouté » ou « Sera retiré »', () => {
    expect(picker).toContain('Accès complet');
    expect(picker).toContain('Sera ajouté');
    expect(picker).toContain('Sera retiré');
  });
  it("l'aperçu reste visible pendant le défilement de la liste des rôles (collé en haut, sans s'étirer)", () => {
    expect(picker).toContain('lg:sticky');
    expect(picker).toContain('lg:self-start');
  });
  it('l\'aperçu est en lecture seule : modules en <details>, tableau légendé, portée écrite en toutes lettres', () => {
    expect(preview).toContain('<details');
    expect(preview).toContain('<caption');
    expect(preview).toContain('SCOPE_LABEL');
    expect(preview).not.toMatch(/<input|<button|onChange|onClick/);
  });
});
