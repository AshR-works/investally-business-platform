import { randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RecoveryCodeGenerator, TotpGenerator } from '../application/mfa-ports';
import { base32Encode } from '../domain/base32';
import { RECOVERY_ALPHABET, RECOVERY_CODE_LENGTH } from '../domain/recovery-codes';

/** Secret TOTP de 160 bits (recommandation RFC 4226), aléa cryptographique. */
@Injectable()
export class CryptoTotpGenerator implements TotpGenerator {
  /** Génère un secret TOTP de 160 bits (aléa cryptographique), encodé en base32. */
  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }
}

/** Codes de secours : `randomInt` est uniforme (pas de biais de modulo) ; unicité garantie dans un lot. */
@Injectable()
export class CryptoRecoveryCodeGenerator implements RecoveryCodeGenerator {
  /** Génère `count` codes de secours distincts, sans biais statistique. */
  generate(count: number): string[] {
    const codes = new Set<string>();
    while (codes.size < count) {
      let code = '';
      for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
      codes.add(code);
    }
    return [...codes];
  }
}
