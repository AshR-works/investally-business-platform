import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfig, DomainError } from '../shared-kernel';
import { domainOfPermission, isDomainReleased } from './released-domains';
import { ReleaseGateGuard } from './release-gate.guard';

const PERMISSION_KEY = 'crm:permission';

class WithPermission {
  @SetMetadata(PERMISSION_KEY, 'bd.company.read')
  protected() {}

  @SetMetadata(PERMISSION_KEY, 'hr.directory.read')
  hr() {}

  open() {}
}

@SetMetadata(PERMISSION_KEY, 'training.session.read')
class ClassLevel {
  list() {}
}

const guard = (released: readonly string[] | null) => new ReleaseGateGuard(new Reflector(), { releasedDomains: released } as AppConfig);
const context = (type: new () => object, method: string) =>
  ({ getHandler: () => (type.prototype as Record<string, () => void>)[method], getClass: () => type }) as unknown as ExecutionContext;

describe('garde de publication', () => {
  it('ne fait rien quand tout est publié', () => {
    expect(guard(null).canActivate(context(WithPermission, 'protected'))).toBe(true);
  });

  it('refuse en « introuvable » une route dont le domaine n’est pas publié', () => {
    const attempt = () => guard(['iam', 'hr']).canActivate(context(WithPermission, 'protected'));
    expect(attempt).toThrow(DomainError);
    try {
      attempt();
    } catch (error) {
      expect((error as DomainError).code).toBe('NOT_FOUND');
      expect((error as DomainError).message).toMatch(/prochaine mise à jour/);
    }
  });

  it('laisse passer un domaine publié', () => {
    expect(guard(['iam', 'hr']).canActivate(context(WithPermission, 'hr'))).toBe(true);
  });

  it('laisse passer les routes sans permission (santé, connexion, profil)', () => {
    expect(guard(['iam']).canActivate(context(WithPermission, 'open'))).toBe(true);
  });

  it('lit aussi la permission portée par la classe', () => {
    expect(() => guard(['iam', 'hr']).canActivate(context(ClassLevel, 'list'))).toThrow(DomainError);
    expect(guard(['iam', 'training']).canActivate(context(ClassLevel, 'list'))).toBe(true);
  });

  it('une liste vide ne publie rien (sauf les routes sans permission)', () => {
    expect(() => guard([]).canActivate(context(WithPermission, 'hr'))).toThrow(DomainError);
    expect(guard([]).canActivate(context(WithPermission, 'open'))).toBe(true);
  });
});

describe('domaines publiés : aides', () => {
  it('le domaine d’une permission est son premier segment', () => {
    expect(domainOfPermission('bd.company.read')).toBe('bd');
    expect(domainOfPermission('iam.user.read')).toBe('iam');
    expect(domainOfPermission('')).toBe('');
  });

  it('null publie tout ; une liste ne publie que ses domaines', () => {
    expect(isDomainReleased(null, 'bd')).toBe(true);
    expect(isDomainReleased(['iam'], 'iam')).toBe(true);
    expect(isDomainReleased(['iam'], 'bd')).toBe(false);
  });
});
