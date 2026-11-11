import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { PasswordHasher } from '../application/ports';

/**
 * argon2id, paramètres du minimum OWASP (SECURITY.md §2.1) : 19 MiB, 2 passes, 1 thread.
 * À relever tant que la connexion reste sous ~500 ms. Le sel est aléatoire et intégré au hachage.
 */
const OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/**
 * Hachage des mots de passe en argon2id (19 Mio, 2 passes, 1 voie : recommandation OWASP). Le sel est intégré au
 * hachage.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private dummyHash: Promise<string> | null = null;

  /** Hache un mot de passe en clair (sel aléatoire propre à chaque hachage). */
  hash(plain: string): Promise<string> {
    return hash(plain, OPTIONS);
  }

  /**
   * Vrai si le mot de passe correspond au hachage ; un hachage illisible donne `false`, jamais une exception qui
   * révélerait l'état du compte.
   */
  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain);
    } catch {
      // Hachage corrompu ou format inconnu : jamais une exception qui révèle l'état du compte.
      return false;
    }
  }

  /** Même coût qu'une vraie vérification (mêmes paramètres), sur un hachage qui ne correspond à aucun compte. */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= hash('hachage-factice-pour-egaliser-les-temps', OPTIONS);
    await verify(await this.dummyHash, plain).catch(() => false);
  }
}
