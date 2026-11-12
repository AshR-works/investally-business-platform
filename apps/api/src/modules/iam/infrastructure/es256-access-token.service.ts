import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  KeyLike, SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair, importPKCS8, importSPKI, jwtVerify,
} from 'jose';
import { AppConfig } from '../../../shared-kernel';
import { AccessTokenClaims, AccessTokenService } from '../application/ports';

const ALGORITHM = 'ES256';
const CLOCK_TOLERANCE_SECONDS = 5;

/**
 * Jeton d'accès JWT signé ES256 (asymétrique : l'ERP pourra vérifier sans connaître le secret de signature).
 * - L'algorithme accepté à la vérification est FIXÉ à ES256 : `alg: none` et la confusion HS256/clé publique sont impossibles.
 * - Aucune permission dans le jeton : elles sont résolues côté serveur pour que la révocation soit immédiate.
 */
export class Es256AccessTokenService implements AccessTokenService {
  private constructor(
    private readonly privateKey: KeyLike,
    private readonly publicKey: KeyLike,
    private readonly keyId: string,
    private readonly issuer: string,
    private readonly audience: string,
  ) {}

  static async create(config: AppConfig): Promise<Es256AccessTokenService> {
    let privateKey: KeyLike;
    let publicKey: KeyLike;

    if (config.jwt.privateKeyPem && config.jwt.publicKeyPem) {
      privateKey = await importPKCS8(config.jwt.privateKeyPem, ALGORITHM);
      publicKey = await importSPKI(config.jwt.publicKeyPem, ALGORITHM);
    } else if (config.env === 'production') {
      throw new Error('Clés de signature JWT absentes en production');
    } else {
      new Logger('Es256AccessTokenService').warn(
        'Aucune clé JWT configurée : paire ÉPHÉMÈRE générée (les jetons ne survivent pas à un redémarrage). Développement et test uniquement.',
      );
      ({ privateKey, publicKey } = await generateKeyPair(ALGORITHM));
    }

    const keyId = await calculateJwkThumbprint(await exportJWK(publicKey));
    return new Es256AccessTokenService(privateKey, publicKey, keyId, config.jwt.issuer, config.jwt.audience);
  }

  /**
   * Signe un jeton d'accès (ES256) : identité, session, méthodes d'authentification, émetteur, audience, échéance.
   * Aucune permission dedans.
   */
  async issue(claims: AccessTokenClaims, ttlMs: number, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const expiresAt = new Date(now.getTime() + ttlMs);
    const token = await new SignJWT({ sid: claims.sid, amr: claims.amr })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT', kid: this.keyId })
      .setSubject(claims.sub)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.privateKey);
    return { token, expiresAt };
  }

  /**
   * Vérifie signature, algorithme, émetteur, audience et échéance ; renvoie les revendications, ou `null` pour tout
   * jeton invalide (jamais d'exception).
   */
  async verify(token: string, now: Date): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: [ALGORITHM],
        issuer: this.issuer,
        audience: this.audience,
        currentDate: now,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      const { sub, sid, amr } = payload as { sub?: unknown; sid?: unknown; amr?: unknown };
      if (typeof sub !== 'string' || typeof sid !== 'string') return null;
      if (!Array.isArray(amr) || !amr.every((method) => typeof method === 'string')) return null;
      return { sub, sid, amr: amr as string[] };
    } catch {
      // Signature, expiration, émetteur, audience, algorithme… : toujours le même refus, sans détail.
      return null;
    }
  }
}
