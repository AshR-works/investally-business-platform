import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RefreshTokenFactory } from '../application/ports';

/** Jeton opaque de 256 bits (aléa cryptographique) ; seule son empreinte SHA-256 est stockée. */
@Injectable()
export class Sha256RefreshTokenFactory implements RefreshTokenFactory {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashOf(token) };
  }

  hashOf(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
