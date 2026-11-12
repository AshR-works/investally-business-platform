import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../shared-kernel';
import { ObjectStorage } from '../domain/ports';

/** Forme exacte d'une clé de stockage (deux niveaux de dossiers puis 48 caractères hexadécimaux) : rien d'autre ne passe. */
const KEY_PATTERN = /^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{48}$/;

/**
 * Stockage des contenus sur disque (CAD-S36-1 B) : dossier HORS racine web, droits restreints (dossiers 0700, fichiers
 * 0600), écriture atomique (fichier temporaire puis renommage). La clé est contrôlée à chaque appel : impossible de
 * sortir du dossier de stockage (aucun `..`, aucun séparateur inattendu). L'adaptateur S3 de production remplacera
 * celui-ci derrière le même port (S7.1).
 */
@Injectable()
export class LocalDiskObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.root = config.documents.directory;
  }

  /** Chemin absolu d'une clé valide ; toute autre forme est une erreur de programmation (jamais une entrée utilisateur). */
  private pathOf(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('Clé de stockage invalide');
    return join(this.root, ...key.split('/'));
  }

  /** Écrit le contenu sous la clé, de façon atomique. */
  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  }

  /** Lit le contenu ; une clé absente est une erreur (la base référence un fichier qui n'existe plus). */
  async get(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  /** Retire un objet qu'on vient d'écrire et qu'aucune ligne en base ne référence ; sans effet s'il n'existe pas. */
  async removeOrphan(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
