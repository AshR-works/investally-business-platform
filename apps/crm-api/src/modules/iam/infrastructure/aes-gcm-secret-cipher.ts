import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { AppConfig } from '../../../shared-kernel';
import { SecretCipher } from '../application/mfa-ports';

const VERSION = 'v1';
const IV_BYTES = 12; // 96 bits : taille recommandée pour GCM
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

/**
 * Chiffrement des secrets TOTP au repos : AES-256-GCM, IV aléatoire par chiffrement, et **données authentifiées
 * liées à l'utilisateur** (AAD) : un secret copié d'un compte à un autre échoue au déchiffrement, et toute
 * altération du chiffré est détectée. Format : `v1.<iv>.<tag>.<chiffré>` (base64url).
 */
export class AesGcmSecretCipher implements SecretCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_BYTES) throw new Error(`La clé de chiffrement doit faire ${KEY_BYTES} octets`);
  }

  static fromConfig(config: AppConfig): AesGcmSecretCipher {
    if (config.mfa.encryptionKeyBase64) return new AesGcmSecretCipher(Buffer.from(config.mfa.encryptionKeyBase64, 'base64'));
    if (config.env === 'production') throw new Error('MFA_ENCRYPTION_KEY est obligatoire en production');
    new Logger('AesGcmSecretCipher').warn(
      'Aucune MFA_ENCRYPTION_KEY : clé ÉPHÉMÈRE générée (les secrets MFA ne survivent pas à un redémarrage). Développement et test uniquement.',
    );
    return new AesGcmSecretCipher(randomBytes(KEY_BYTES));
  }

  encrypt(plain: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(aad(context));
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
  }

  decrypt(blob: string, context: string): string {
    const [version, ivPart, tagPart, dataPart, ...rest] = blob.split('.');
    if (version !== VERSION || !ivPart || !tagPart || dataPart === undefined || rest.length > 0) {
      throw new Error('Secret chiffré illisible');
    }
    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error('Secret chiffré illisible');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(aad(context));
    decipher.setAuthTag(tag);
    // Lève si le chiffré a été altéré ou si le contexte (utilisateur) ne correspond pas.
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
  }
}

function aad(context: string): Buffer {
  return Buffer.from(`investally:mfa:${context}`, 'utf8');
}
