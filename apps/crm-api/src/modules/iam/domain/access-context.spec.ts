import { AccessContext, decideFor, visibilityFor } from './access-context';
import { Scope } from './roles';

const context = (grants: AccessContext['grants']): AccessContext => ({ actorId: 'me', grants, teamMemberIds: ['report-1', 'report-2'] });

describe('visibilityFor', () => {
  it('Tous : aucune restriction', () => {
    expect(visibilityFor(context([{ permission: 'bd.company.read', scope: Scope.All }]), 'bd.company.read')).toEqual({ unrestricted: true });
  });

  it("Équipe : soi-même et les subordonnés DIRECTS seulement", () => {
    expect(visibilityFor(context([{ permission: 'bd.company.read', scope: Scope.Team }]), 'bd.company.read')).toEqual({
      unrestricted: false, ownerIds: ['me', 'report-1', 'report-2'],
    });
  });

  it('Propre : soi-même seulement', () => {
    expect(visibilityFor(context([{ permission: 'bd.company.read', scope: Scope.Own }]), 'bd.company.read')).toEqual({ unrestricted: false, ownerIds: ['me'] });
  });

  it('permission absente : AUCUN objet visible (liste vide, jamais « tout »)', () => {
    expect(visibilityFor(context([]), 'bd.company.read')).toEqual({ unrestricted: false, ownerIds: [] });
    expect(visibilityFor(context([{ permission: 'bd.company.update', scope: Scope.All }]), 'bd.company.read')).toEqual({ unrestricted: false, ownerIds: [] });
  });
});

describe('decideFor', () => {
  it('applique la portée à un objet précis', () => {
    const ctx = context([{ permission: 'bd.company.read', scope: Scope.Team }]);
    expect(decideFor(ctx, 'bd.company.read', 'report-1').allowed).toBe(true);
    expect(decideFor(ctx, 'bd.company.read', 'stranger').allowed).toBe(false);
    expect(decideFor(ctx, 'bd.company.read', null).allowed).toBe(false);
  });
});
