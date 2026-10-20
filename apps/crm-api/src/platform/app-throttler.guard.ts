import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestLike {
  ip?: string;
  path?: string;
  body?: { email?: unknown };
}

/**
 * Limitation de débit : par IP en général (100 req/min) ; pour la connexion, par couple IP + e-mail,
 * afin qu'un attaquant ne puisse ni cibler un compte depuis une IP, ni bloquer un compte depuis une autre IP.
 * Stockage en mémoire : valable pour UNE instance (à remplacer par un stockage partagé si on en déploie plusieurs).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as RequestLike;
    const ip = request.ip ?? 'unknown';
    if (request.path?.endsWith('/auth/login')) {
      const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase().slice(0, 254) : '';
      return `${ip}|${email}`;
    }
    return ip;
  }
}
