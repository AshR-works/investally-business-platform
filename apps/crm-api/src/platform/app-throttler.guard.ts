import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestLike {
  ip?: string;
  path?: string;
  body?: { email?: unknown };
  headers?: Record<string, string | string[] | undefined>;
}

/** Identifiant de session lu dans le jeton SANS vérifier sa signature (clé de limitation uniquement). */
function sessionHint(authorization: string | string[] | undefined): string {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const token = /^Bearer ([\w.~+/=-]+)$/.exec(value ?? '')?.[1];
  try {
    const payload = JSON.parse(Buffer.from(token?.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sid?: unknown };
    return typeof payload.sid === 'string' ? payload.sid.slice(0, 64) : '';
  } catch {
    return '';
  }
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
    if (request.path?.includes('/auth/mfa/')) {
      // Des collègues derrière la même adresse (bureau) ne doivent pas se bloquer entre eux : clé = IP + session.
      // Un attaquant qui falsifie l'identifiant de session évite seulement cette limite ; ses requêtes échouent
      // alors à l'authentification du jeton, et le verrouillage du compte (par utilisateur) reste la vraie protection.
      return `${ip}|${sessionHint(request.headers?.authorization)}`;
    }
    return ip;
  }
}
