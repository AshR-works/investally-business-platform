import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_CONFIG, AppConfig, DomainError } from '../shared-kernel';
import { domainOfPermission, isDomainReleased } from './released-domains';

/** Clé de métadonnée posée par `@Protected(permission)` (même valeur que dans le module IAM : la plateforme ne l'importe pas, elle lit la métadonnée). */
const PERMISSION_KEY = 'crm:permission';

/**
 * Garde GLOBALE de publication. Chaque route protégée déclare une permission, dont le premier segment est son domaine (`bd`, `training`, `hr`…) : un domaine
 * non publié (`RELEASED_DOMAINS`) répond « introuvable » à tout le monde, authentifié ou non, avant même de regarder les droits. Les routes sans permission
 * (santé, connexion, profil) ne sont pas concernées. Une nouvelle route est couverte d'office : elle porte sa permission.
 */
@Injectable()
export class ReleaseGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.releasedDomains === null) return true;
    const permission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!permission) return true;
    if (isDomainReleased(this.config.releasedDomains, domainOfPermission(permission))) return true;
    throw new DomainError('NOT_FOUND', "Cette fonction n'est pas encore disponible : elle est prévue pour une prochaine mise à jour.");
  }
}
