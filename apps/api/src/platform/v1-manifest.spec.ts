import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..', '..');
const migrationsDir = join(repo, 'apps', 'api', 'prisma', 'migrations');
const manifest = JSON.parse(readFileSync(join(repo, 'docs', 'base-de-donnees', 'V1-MANIFESTE.json'), 'utf8')) as {
  version: string;
  migrations: { name: string; sha256: string }[];
  referenceData: Record<string, number>;
  tablesCount: number;
};
const sha256 = (name: string) => createHash('sha256').update(readFileSync(join(migrationsDir, name, 'migration.sql'))).digest('hex');
const onDisk = () => readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(migrationsDir, d.name, 'migration.sql'))).map((d) => d.name).sort();

/**
 * Base de données V1 (production) : les migrations de la V1 sont figées. Les modifier ferait diverger une base déjà installée de celle que le dépôt décrit ; ce test
 * échoue alors. Les migrations suivantes s'ajoutent après la V1 sans le faire échouer. Contrôle complet avec une base : `scripts/db-docs/v1-manifest.mjs check`.
 */
describe('Base de données V1 : migrations figées', () => {
  it('le manifeste décrit la V1 et ses migrations dans l’ordre', () => {
    expect(manifest.version).toBe('V1');
    expect(manifest.migrations.length).toBeGreaterThanOrEqual(31);
    const names = manifest.migrations.map((m) => m.name);
    expect([...names].sort()).toEqual(names);
    expect(new Set(names).size).toBe(names.length);
  });

  it('chaque migration de la V1 existe encore, sans une seule modification', () => {
    for (const m of manifest.migrations) {
      expect([m.name, existsSync(join(migrationsDir, m.name, 'migration.sql'))]).toEqual([m.name, true]);
      expect([m.name, sha256(m.name)]).toEqual([m.name, m.sha256]);
    }
  });

  it('aucune migration n’est insérée avant la fin de la V1 ; celles d’après sont permises', () => {
    const v1 = new Set(manifest.migrations.map((m) => m.name));
    const last = manifest.migrations[manifest.migrations.length - 1]!.name;
    const intruders = onDisk().filter((name) => !v1.has(name) && name < last);
    expect(intruders).toEqual([]);
  });

  it('les données de référence attendues d’une base neuve sont déclarées (rôles, droits, types, modèles)', () => {
    expect(Object.keys(manifest.referenceData).sort()).toEqual([
      'hr.contract_types', 'hr.journey_template_tasks', 'hr.journey_templates', 'hr.leave_settings', 'hr.leave_types', 'iam.permissions', 'iam.role_permissions', 'iam.roles',
    ]);
    expect(manifest.referenceData['iam.roles']).toBe(10);
    expect(manifest.referenceData['hr.journey_templates']).toBe(2);
    expect(manifest.tablesCount).toBeGreaterThanOrEqual(50);
  });
});
