import { PERMISSIONS, PERMISSION_CODES } from './permission-catalog';
import { ROLES, ROLE_GRANTS, RoleCode, Scope, resolveGrants, unknownPatterns } from './roles';

const codesOf = (role: RoleCode) => resolveGrants(role).map((g) => g.permission);

describe('Catalogue de permissions', () => {
  it('a des codes uniques au format module.ressource.action', () => {
    const codes = PERMISSIONS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z]+\.[a-z_]+\.[a-z_]+$/);
  });

  it("n'offre aucune permission d'écriture ou de suppression sur le journal d'audit (append-only)", () => {
    const auditActions = PERMISSIONS.filter((p) => p.module === 'audit').map((p) => p.action);
    expect(auditActions.sort()).toEqual(['export', 'read']);
  });
});

describe('Matrice rôles → permissions', () => {
  it('ne contient aucune faute de frappe (tout motif correspond au catalogue)', () => {
    expect(unknownPatterns()).toEqual([]);
  });

  it('définit exactement un jeu de droits par rôle déclaré', () => {
    expect(Object.keys(ROLE_GRANTS).sort()).toEqual(ROLES.map((r) => r.code).sort());
  });

  it("n'a aucune permission orpheline : chaque permission est accordée à au moins un rôle", () => {
    const granted = new Set(Object.values(RoleCode).flatMap(codesOf));
    const orphans = [...PERMISSION_CODES].filter((code) => !granted.has(code));
    expect(orphans).toEqual([]);
  });

  it('donne au SuperAdmin toutes les permissions du catalogue, en portée Tous (décision produit)', () => {
    const granted = resolveGrants(RoleCode.SuperAdmin);
    expect(granted.map((g) => g.permission).sort()).toEqual([...PERMISSION_CODES].sort());
    expect(granted.every((g) => g.scope === Scope.All)).toBe(true);
  });

  it("réserve la gestion des comptes et des rôles au SuperAdmin", () => {
    const adminOnly = ['iam.user.create', 'iam.user.update', 'iam.user.disable', 'iam.user.assign_role', 'iam.user.reset_mfa', 'iam.role.manage'];
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.SuperAdmin)) {
      expect(codesOf(role).filter((c) => adminOnly.includes(c))).toEqual([]);
    }
    for (const code of adminOnly) expect(codesOf(RoleCode.SuperAdmin)).toContain(code);
  });

  it('limite la Direction à la lecture, au téléchargement et à l’export sur le métier', () => {
    const allowedActions = new Set(['read', 'export', 'download']);
    const direction = resolveGrants(RoleCode.Direction).filter((g) => /^(bd|training|docs)\./.test(g.permission));
    const writes = direction.filter((g) => !allowedActions.has(g.permission.split('.')[2]));
    expect(writes).toEqual([]);
  });

  it("ne donne au chargé de compte aucune portée ALL sur le pipeline commercial", () => {
    const wide = resolveGrants(RoleCode.AccountManager).filter((g) => g.permission.startsWith('bd.') && g.scope === Scope.All);
    expect(wide).toEqual([]);
  });

  it("n'accorde aucun export massif au chargé de compte, au support ni au formateur", () => {
    for (const role of [RoleCode.AccountManager, RoleCode.Support, RoleCode.Trainer]) {
      expect(codesOf(role).filter((c) => c.endsWith('.export'))).toEqual([]);
    }
  });

  it('ne donne aucun droit métier aux rôles RH et Fiscalité dans le CRM', () => {
    for (const role of [RoleCode.Hr, RoleCode.Tax]) {
      expect(codesOf(role).filter((c) => !c.startsWith('iam.session.'))).toEqual([]);
    }
  });

  it("n'accorde jamais iam.session.revoke ou read en portée ALL à un rôle autre que SuperAdmin", () => {
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.SuperAdmin)) {
      const wide = resolveGrants(role).filter((g) => g.permission.startsWith('iam.session.') && g.scope === Scope.All);
      expect(wide).toEqual([]);
    }
  });

  it('exige le MFA pour tous les rôles (décision produit)', () => {
    expect(ROLES.filter((r) => !r.mfaRequired).map((r) => r.code)).toEqual([]);
  });

  it('retient la portée la plus large quand un motif et un code exact se recoupent', () => {
    const hos = resolveGrants(RoleCode.HeadOfSales).find((g) => g.permission === 'bd.opportunity.read');
    expect(hos?.scope).toBe(Scope.All);
  });
});
