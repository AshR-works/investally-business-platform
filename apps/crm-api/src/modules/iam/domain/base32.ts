import { DomainError } from '../../../shared-kernel';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 (RFC 4648) sans remplissage : format attendu par les applications d'authentification. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** Décode du base32 ; tolère minuscules, espaces et `=` de fin ; refuse tout autre caractère. */
export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/[\s=]/g, '').toUpperCase();
  if (cleaned.length === 0) throw new DomainError('VALIDATION', 'Base32 vide');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new DomainError('VALIDATION', 'Caractère base32 invalide');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
