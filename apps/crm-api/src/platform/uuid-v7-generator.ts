import { randomBytes } from 'node:crypto';
import { IdGenerator } from '../shared-kernel';

/** UUID v7 (RFC 9562) : 48 bits d'horodatage ms + aléa. Triable par date de création. */
export class UuidV7Generator implements IdGenerator {
  next(): string {
    const bytes = randomBytes(16);
    const timestamp = BigInt(Date.now());
    for (let i = 0; i < 6; i++) {
      bytes[i] = Number((timestamp >> BigInt(8 * (5 - i))) & 0xffn);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
