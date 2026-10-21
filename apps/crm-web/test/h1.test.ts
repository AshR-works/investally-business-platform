import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODULES, availableModules, upcomingModules } from '../lib/modules';
import type { Profile } from '../lib/types';

vi.mock('../lib/api', () => ({ api: vi.fn() }));
import { api } from '../lib/api';
import { HITS_PER_TYPE, MIN_QUERY_LENGTH, searchAll } from '../lib/search';
import { readTheme } from '../lib/theme';

const profile = (codes: string[]): Profile => ({
  userId: 'u1', email: 'a@e2e.test', displayName: 'A', roles: [], mfaEnrolled: true,
  permissions: codes.map((code) => ({ code, scope: 'ALL' as const })),
});

describe('jetons du design', () => {
  /** Déclarations `--nom: valeur;` d'un fichier de jetons, hors polices (les chemins diffèrent entre prototype et application). */
  const declarations = (path: string) =>
    readFileSync(resolve(__dirname, path), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^--[a-z0-9-]+:/.test(line));

  it('l\'application reprend exactement les jetons du design validé', () => {
    const source = declarations('../../../docs/design/prototype/tokens.css');
    const copy = declarations('../app/tokens.css');
    expect(source.length).toBeGreaterThan(80);
    expect(copy).toEqual(source);
  });
});

describe('catalogue des modules', () => {
  it('identifiants uniques et groupes connus', () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    for (const m of MODULES) expect(['Espace de travail', 'Opérations', 'Pilotage', 'Gouvernance']).toContain(m.group);
  });
  it('un module n\'apparaît dans la navigation que s\'il est livré ET autorisé', () => {
    expect(availableModules(profile([])).map((m) => m.id)).toEqual([]);
    expect(availableModules(profile(['bd.company.read'])).map((m) => m.id)).toEqual(['companies']);
    expect(availableModules(profile(['bd.company.read', 'iam.user.read'])).map((m) => m.id)).toEqual(['companies', 'users']);
    expect(availableModules(null)).toEqual([]);
  });
  it('les modules à venir n\'ont aucun lien cliquable', () => {
    for (const m of upcomingModules()) expect(m.href).toBeUndefined();
  });
});

describe('recherche globale', () => {
  afterEach(() => vi.mocked(api).mockReset());

  it('n\'appelle pas le serveur sous le seuil de caractères', async () => {
    expect(await searchAll('a'.repeat(MIN_QUERY_LENGTH - 1), profile(['bd.company.read']))).toEqual([]);
    expect(api).not.toHaveBeenCalled();
  });
  it('n\'interroge que les types que le profil peut lire', async () => {
    vi.mocked(api).mockResolvedValue({ items: [], total: 0 });
    await searchAll('hor', profile([]));
    expect(api).not.toHaveBeenCalled();
    await searchAll('hor', profile(['iam.user.read']));
    expect(vi.mocked(api).mock.calls.map((c) => String(c[0]).split('?')[0])).toEqual(['/admin/users']);
  });
  it('regroupe les résultats par type et borne leur nombre dans la requête', async () => {
    vi.mocked(api).mockImplementation(async (path: string) =>
      path.startsWith('/companies')
        ? { items: [{ id: 'c1', name: 'Société Horizon SA', status: 'TARGET', sector: 'Banque' }], total: 1 }
        : { items: [{ id: 'u1', displayName: 'Horace', email: 'h@e2e.test' }], total: 1 },
    );
    const hits = await searchAll(' hor ', profile(['bd.company.read', 'iam.user.read']));
    expect(hits.map((h) => [h.type, h.title])).toEqual([['Entreprises', 'Société Horizon SA'], ['Utilisateurs', 'Horace']]);
    expect(String(vi.mocked(api).mock.calls[0][0])).toContain(`pageSize=${HITS_PER_TYPE}`);
    expect(String(vi.mocked(api).mock.calls[0][0])).toContain('search=hor');
  });
  it('une requête en échec ne masque pas les autres types', async () => {
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/companies')) throw new Error('indisponible');
      return { items: [{ id: 'u1', displayName: 'Horace', email: 'h@e2e.test' }], total: 1 };
    });
    const hits = await searchAll('hor', profile(['bd.company.read', 'iam.user.read']));
    expect(hits.map((h) => h.type)).toEqual(['Utilisateurs']);
  });
  it('une recherche abandonnée ne renvoie rien', async () => {
    const controller = new AbortController();
    vi.mocked(api).mockImplementation(async () => {
      controller.abort();
      return { items: [{ id: 'c1', name: 'X', status: 'TARGET', sector: null }], total: 1 };
    });
    expect(await searchAll('hor', profile(['bd.company.read']), controller.signal)).toEqual([]);
  });
});

describe('thème', () => {
  it('retombe sur le réglage de l\'appareil si le stockage est indisponible', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); } });
    expect(readTheme()).toBe('system');
    vi.unstubAllGlobals();
  });
  it('ne connaît que clair, sombre ou appareil', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'rose' });
    expect(readTheme()).toBe('system');
    vi.stubGlobal('localStorage', { getItem: () => 'dark' });
    expect(readTheme()).toBe('dark');
    vi.unstubAllGlobals();
  });
});
