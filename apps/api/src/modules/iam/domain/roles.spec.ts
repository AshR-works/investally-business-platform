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
    const adminOnly = ['iam.user.create', 'iam.user.update', 'iam.user.disable', 'iam.user.assign_role', 'iam.user.reset_mfa', 'iam.user.reset_password', 'iam.role.manage', 'iam.export.read'];
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

  it('ne donne aucun droit commercial ni Investudy aux rôles RH et Fiscalité ; seule la RH gère le personnel (D57)', () => {
    for (const role of [RoleCode.Hr, RoleCode.Tax]) {
      expect(codesOf(role).filter((c) => !c.startsWith('iam.session.') && !c.startsWith('hr.'))).toEqual([]);
    }
    expect(codesOf(RoleCode.Tax).filter((c) => c.startsWith('hr.') && !c.startsWith('hr.leave.') && !c.startsWith('hr.contract.') && !c.startsWith('hr.journey.') && !c.startsWith('hr.presence.'))).toEqual(['hr.directory.read', 'hr.employee.read']);
    expect(codesOf(RoleCode.Hr).filter((c) => c.startsWith('hr.') && !c.startsWith('hr.leave.') && !c.startsWith('hr.contract.') && !c.startsWith('hr.journey.') && !c.startsWith('hr.presence.'))).toEqual(['hr.directory.read', 'hr.employee.archive', 'hr.employee.create', 'hr.employee.read', 'hr.employee.update']);
  });

  it('RH légère (D57) : l’annuaire est lisible de tous en portée Tous ; la fiche suit la portée ; seuls la RH et le Super administrateur écrivent', () => {
    const scope = (role: RoleCode, permission: string) => resolveGrants(role).find((g) => g.permission === permission)?.scope;
    for (const role of Object.values(RoleCode)) expect([role, scope(role, 'hr.directory.read')]).toEqual([role, Scope.All]);
    expect(scope(RoleCode.Hr, 'hr.employee.read')).toBe(Scope.All);
    expect(scope(RoleCode.Direction, 'hr.employee.read')).toBe(Scope.All);
    expect(scope(RoleCode.SuperAdmin, 'hr.employee.read')).toBe(Scope.All);
    expect(scope(RoleCode.HeadOfSales, 'hr.employee.read')).toBe(Scope.Team);
    expect(scope(RoleCode.AccountManager, 'hr.employee.read')).toBe(Scope.Own);
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.Hr && r !== RoleCode.SuperAdmin)) {
      expect(codesOf(role).filter((c) => ['hr.employee.create', 'hr.employee.update', 'hr.employee.archive'].includes(c))).toEqual([]);
    }
    // Aucune permission de salaire, de paie ou de donnée sensible n'existe dans le catalogue.
    expect(codesOf(RoleCode.SuperAdmin).filter((c) => c.startsWith('hr.') && !c.startsWith('hr.leave.') && !c.startsWith('hr.contract.') && !c.startsWith('hr.journey.') && !c.startsWith('hr.presence.')).sort()).toEqual(['hr.directory.read', 'hr.employee.archive', 'hr.employee.create', 'hr.employee.read', 'hr.employee.update']);
  });

  it('absences et congés (D64) : chacun demande et lit les siennes et valide celles de son équipe directe ; la RH et le Super administrateur gèrent ; la Direction lit tout', () => {
    const scope = (role: RoleCode, permission: string) => resolveGrants(role).find((g) => g.permission === permission)?.scope;
    for (const role of Object.values(RoleCode)) {
      expect([role, scope(role, 'hr.leave.create') !== undefined]).toEqual([role, true]);
      expect([role, scope(role, 'hr.leave.approve') !== undefined]).toEqual([role, true]);
      expect([role, scope(role, 'hr.leave.read') !== undefined]).toEqual([role, true]);
    }
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.Hr && r !== RoleCode.SuperAdmin)) {
      expect([role, scope(role, 'hr.leave.create')]).toEqual([role, Scope.Own]);
      expect([role, scope(role, 'hr.leave.approve')]).toEqual([role, Scope.Own]);
      expect([role, scope(role, 'hr.leave.manage')]).toEqual([role, undefined]);
      expect([role, scope(role, 'hr.leave.read')]).toEqual([role, role === RoleCode.Direction ? Scope.All : Scope.Own]);
    }
    for (const role of [RoleCode.Hr, RoleCode.SuperAdmin]) {
      for (const action of ['read', 'create', 'approve', 'manage']) expect([role, action, scope(role, `hr.leave.${action}`)]).toEqual([role, action, Scope.All]);
    }
  });

  it('contrats du personnel (D67) : la RH et le Super administrateur gèrent, la Direction lit tout, chacun lit le sien, personne d’autre ne gère', () => {
    const scope = (role: RoleCode, permission: string) => resolveGrants(role).find((g) => g.permission === permission)?.scope;
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.Hr && r !== RoleCode.SuperAdmin)) {
      expect([role, scope(role, 'hr.contract.manage')]).toEqual([role, undefined]);
      expect([role, scope(role, 'hr.contract.read')]).toEqual([role, role === RoleCode.Direction ? Scope.All : Scope.Own]);
    }
    for (const role of [RoleCode.Hr, RoleCode.SuperAdmin]) {
      for (const action of ['read', 'manage']) expect([role, action, scope(role, `hr.contract.${action}`)]).toEqual([role, action, Scope.All]);
    }
    // Aucune permission de salaire ni de paie dans le catalogue.
    for (const role of Object.values(RoleCode)) expect(codesOf(role).filter((c) => /salary|salaire|payroll|paie/.test(c))).toEqual([]);
  });

  it('présences déclaratives (D69) : chacun déclare pour soi et lit sa ligne ; la RH et le Super administrateur déclarent pour tous ; la RH et la Direction lisent tout', () => {
    const scope = (role: RoleCode, permission: string) => resolveGrants(role).find((g) => g.permission === permission)?.scope;
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.Hr && r !== RoleCode.SuperAdmin)) {
      expect([role, 'declare', scope(role, 'hr.presence.declare')]).toEqual([role, 'declare', Scope.Own]);
      expect([role, 'read', scope(role, 'hr.presence.read')]).toEqual([role, 'read', role === RoleCode.Direction ? Scope.All : Scope.Own]);
    }
    for (const role of [RoleCode.Hr, RoleCode.SuperAdmin]) {
      for (const action of ['read', 'declare']) expect([role, action, scope(role, `hr.presence.${action}`)]).toEqual([role, action, Scope.All]);
    }
  });

  it('parcours d’intégration et de départ (D67) : la RH et le Super administrateur gèrent, la Direction lit tout, chacun lit les siens, personne d’autre ne gère', () => {
    const scope = (role: RoleCode, permission: string) => resolveGrants(role).find((g) => g.permission === permission)?.scope;
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.Hr && r !== RoleCode.SuperAdmin)) {
      expect([role, scope(role, 'hr.journey.manage')]).toEqual([role, undefined]);
      expect([role, scope(role, 'hr.journey.read')]).toEqual([role, role === RoleCode.Direction ? Scope.All : Scope.Own]);
    }
    for (const role of [RoleCode.Hr, RoleCode.SuperAdmin]) {
      for (const action of ['read', 'manage']) expect([role, action, scope(role, `hr.journey.${action}`)]).toEqual([role, action, Scope.All]);
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
