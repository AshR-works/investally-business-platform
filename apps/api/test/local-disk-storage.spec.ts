import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskObjectStorage } from '../src/modules/documents/infrastructure/local-disk-object-storage';
import type { AppConfig } from '../src/shared-kernel';

const KEY = `ab/cd/${'0123456789abcdef'.repeat(3)}`;

describe('Stockage sur disque', () => {
  let dir: string;
  let storage: LocalDiskObjectStorage;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'investally-storage-'));
    storage = new LocalDiskObjectStorage({ documents: { directory: dir } } as AppConfig);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('écrit puis relit exactement les mêmes octets, sous la clé (deux niveaux de dossiers)', async () => {
    const data = Buffer.from([0, 1, 2, 255, 254]);
    await storage.put(KEY, data);
    expect((await storage.get(KEY)).equals(data)).toBe(true);
    expect((await stat(join(dir, 'ab', 'cd', KEY.split('/')[2]))).isFile()).toBe(true);
  });
  it('ne laisse aucun fichier temporaire après une écriture', async () => {
    await storage.put(KEY, Buffer.from('x'));
    expect(await readdir(join(dir, 'ab', 'cd'))).toEqual([KEY.split('/')[2]]);
  });
  it('refuse toute clé qui n\'a pas la forme attendue : aucune sortie du dossier possible', async () => {
    const bad = ['../secret', '../../etc/passwd', '/etc/passwd', 'C:' + String.fromCharCode(92) + 'x', 'ab/cd/..', 'ab/cd/AB', 'ab/cd/xyz', `ab/cd/${'0'.repeat(47)}`, `ab/cd/${'0'.repeat(49)}`, `ab/../cd/${'0'.repeat(48)}`, '', `ab/cd/${'0'.repeat(48)}/extra`];
    for (const key of bad) {
      await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow('Clé de stockage invalide');
      await expect(storage.get(key)).rejects.toThrow('Clé de stockage invalide');
      await expect(storage.removeOrphan(key)).rejects.toThrow('Clé de stockage invalide');
    }
  });
  it('lire une clé absente est une erreur (la base référence un fichier perdu)', async () => {
    await expect(storage.get(KEY)).rejects.toThrow();
  });
  it('retirer un orphelin : retire le fichier, sans erreur s\'il n\'existe pas (idempotent)', async () => {
    await storage.put(KEY, Buffer.from('x'));
    await storage.removeOrphan(KEY);
    await expect(storage.get(KEY)).rejects.toThrow();
    await expect(storage.removeOrphan(KEY)).resolves.toBeUndefined();
  });
  (process.platform === 'win32' ? it.skip : it)('droits restreints : fichier 0600, dossiers 0700', async () => {
    await storage.put(KEY, Buffer.from('x'));
    expect((await stat(join(dir, 'ab', 'cd', KEY.split('/')[2]))).mode & 0o777).toBe(0o600);
    expect((await stat(join(dir, 'ab'))).mode & 0o777).toBe(0o700);
  });
});
