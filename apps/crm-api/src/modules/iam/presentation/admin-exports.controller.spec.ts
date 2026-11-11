import 'reflect-metadata';
import { MIN_SCOPE_KEY, PERMISSION_KEY } from './protected.decorator';
import { AdminExportsController } from './admin-exports.controller';

/**
 * Ce que la route d'export exige, lu dans ses métadonnées (sans base ni serveur) : la permission d'export, la portée Tous, et les gardes dans l'ordre (jeton, second
 * facteur, permission, second facteur RÉCENT). Un changement de l'un de ces éléments fait échouer ce test avant qu'une route plus ouverte ne parte en production.
 */
describe('route d’export : ce qu’elle exige', () => {
  const handler = AdminExportsController.prototype.download;
  const guards = (Reflect.getMetadata('__guards__', handler) as { name: string }[]).map((g) => g.name);

  it('exige la permission d’export, en portée Tous', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, handler)).toBe('iam.export.read');
    expect(Reflect.getMetadata(MIN_SCOPE_KEY, handler)).toBe('ALL');
  });

  it('exige un jeton, un second facteur vérifié, la permission, puis un second facteur RÉCENT, dans cet ordre', () => {
    expect(guards).toEqual(['AccessTokenGuard', 'RequireMfaGuard', 'PermissionGuard', 'RequireRecentMfaGuard']);
  });

  it('est une route de lecture (GET) sur /admin/exports/:kind', () => {
    expect(Reflect.getMetadata('path', AdminExportsController)).toBe('admin/exports');
    expect(Reflect.getMetadata('path', handler)).toBe(':kind');
    expect(Reflect.getMetadata('method', handler)).toBe(0); // RequestMethod.GET
  });
});
