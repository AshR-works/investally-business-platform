import { decideAccess } from './access-policy';
import { Scope } from './roles';

const base = { actorId: 'me', teamMemberIds: ['report-1'], resourceOwnerId: undefined as string | null | undefined };

describe('decideAccess', () => {
  it('refuse par défaut quand la permission est absente', () => {
    expect(decideAccess({ ...base, grants: [], permission: 'bd.company.read' })).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it("n'accepte pas une permission voisine (pas de correspondance partielle)", () => {
    const grants = [{ permission: 'bd.company.read', scope: Scope.All }];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.update' }).allowed).toBe(false);
  });

  it('accorde tout objet en portée ALL', () => {
    const grants = [{ permission: 'bd.company.read', scope: Scope.All }];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: 'someone' })).toEqual({ allowed: true, scope: Scope.All });
  });

  it("limite la portée OWN aux objets de l'acteur (prévention d'IDOR)", () => {
    const grants = [{ permission: 'bd.company.read', scope: Scope.Own }];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: 'me' }).allowed).toBe(true);
    expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: 'other' })).toEqual({ allowed: false, reason: 'OUT_OF_SCOPE' });
    expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: 'report-1' }).allowed).toBe(false);
  });

  it("étend la portée TEAM aux subordonnés directs seulement", () => {
    const grants = [{ permission: 'bd.company.update', scope: Scope.Team }];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.update', resourceOwnerId: 'report-1' }).allowed).toBe(true);
    expect(decideAccess({ ...base, grants, permission: 'bd.company.update', resourceOwnerId: 'me' }).allowed).toBe(true);
    expect(decideAccess({ ...base, grants, permission: 'bd.company.update', resourceOwnerId: 'stranger' }).allowed).toBe(false);
  });

  it('autorise création et liste (aucun objet précis : undefined) avec la portée de la permission, pour filtrage ultérieur', () => {
    const grants = [{ permission: 'bd.company.create', scope: Scope.Own }];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.create' })).toEqual({ allowed: true, scope: Scope.Own });
  });

  it('REFUSE un objet existant SANS propriétaire (null) en portée Propre et Équipe : ne pas le traiter comme une liste', () => {
    for (const scope of [Scope.Own, Scope.Team]) {
      const grants = [{ permission: 'bd.company.read', scope }];
      expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: null })).toEqual({ allowed: false, reason: 'OUT_OF_SCOPE' });
    }
  });

  it('autorise un objet sans propriétaire seulement en portée Tous', () => {
    const grants = [{ permission: 'bd.company.read', scope: Scope.All }];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: null })).toEqual({ allowed: true, scope: Scope.All });
  });

  it('retient la portée la plus large quand deux rôles accordent la même permission', () => {
    const grants = [
      { permission: 'bd.company.read', scope: Scope.Own },
      { permission: 'bd.company.read', scope: Scope.All },
    ];
    expect(decideAccess({ ...base, grants, permission: 'bd.company.read', resourceOwnerId: 'other' })).toEqual({ allowed: true, scope: Scope.All });
  });
});
