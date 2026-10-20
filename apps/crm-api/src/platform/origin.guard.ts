import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig, DomainError } from '../shared-kernel';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Défense CSRF globale en plus de `SameSite=Strict` : toute requête qui MODIFIE (POST, PUT, PATCH, DELETE) et dont
 * l'en-tête `Origin` n'est pas autorisé est refusée, sur TOUTES les routes (aucune route ne peut l'oublier).
 * Les clients non navigateur n'envoient pas d'Origin : ils ne sont pas exposés au CSRF et restent acceptés.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method: string; headers: Record<string, string | undefined> }>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    const origin = request.headers.origin;
    if (origin && !this.config.allowedOrigins.includes(origin)) throw new DomainError('FORBIDDEN', 'Origine non autorisée');
    return true;
  }
}
