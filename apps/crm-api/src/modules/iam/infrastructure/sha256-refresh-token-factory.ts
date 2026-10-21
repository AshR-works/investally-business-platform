import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RefreshTokenFactory } from '../application/ports';

/** Jeton opaque de 256 bits (aléa cryptographique) ; seule son empreinte SHA-256 est stockée. */
@Injectable()
export class Sha256RefreshTokenFactory implements RefreshTokenFactory {
  /**
   * Génère un jeton opaque de 256 bits (aléa cryptographique) et son empreinte SHA-256 ; seule l'empreinte est
   * stockée.
   */
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashOf(token) };
  }

  /** Empreinte SHA-256 d'un jeton présenté (pour le retrouver en base sans jamais le stocker). */
  hashOf(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
