import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeModule, availableModules, byDomain, DOMAINS, MODULES, upcomingModules } from '../lib/modules';
import type { Profile } from '../lib/types';

const profileWith = (...permissions: string[]) => ({ permissions: permissions.map((code) => ({ code, scope: 'ALL' })) }) as unknown as Profile;
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('menu par domaines (D51)', () => {
  it('sept domaines dans l\'ordre voulu ; chaque module appartient à un seul domaine connu', () => {
    expect([...DOMAINS]).toEqual(['CRM', 'Investudy', 'Finance', 'Ressources humaines', 'Stocks', 'Reporting', 'Administration']);
    for (const m of MODULES) expect(DOMAINS).toContain(m.group);
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    const hrefs = MODULES.filter((m) => m.href).map((m) => m.href);
    expect(new Set(hrefs).size).toBe(hrefs.length); // aucun écran à deux endroits
  });

  it('le CRM et Investudy listent leurs écrans dans l\'ordre du cadrage', () => {
    const ids = (domain: string) => MODULES.filter((m) => m.group === domain && m.href).map((m) => m.id);
    expect(ids('CRM')).toEqual(['companies', 'contacts', 'opportunities', 'offers', 'approvals', 'followups', 'agenda', 'ambassadors']);
    expect(ids('Investudy')).toEqual(['training', 'sessions', 'enrollments', 'learners']);
  });

  it('les Commissions vivent sous Finance, une seule fois (D54)', () => {
    const commissions = MODULES.filter((m) => m.href === '/commissions');
    expect(commissions).toHaveLength(1);
    expect(commissions[0]!.group).toBe('Finance');
  });

  it('un domaine sans module visible pour le profil n\'apparaît pas', () => {
    expect(byDomain(availableModules(profileWith())).map((d) => d.domain)).toEqual([]);
    expect(byDomain(availableModules(profileWith('bd.company.read'))).map((d) => d.domain)).toEqual(['CRM']);
    expect(byDomain(availableModules(profileWith('bd.company.read', 'training.session.read', 'iam.user.read'))).map((d) => d.domain)).toEqual(['CRM', 'Investudy', 'Administration']);
    expect(byDomain(availableModules(profileWith('bd.commission.read'))).map((d) => d.domain)).toEqual(['Finance']);
  });

  it('les modules à venir restent hors du menu mais rangés dans leur domaine (hub)', () => {
    const upcoming = upcomingModules();
    expect(upcoming.map((m) => m.group)).toEqual(expect.arrayContaining(['Finance', 'Ressources humaines', 'Stocks', 'Reporting', 'Administration']));
    for (const m of upcoming) expect(m.href).toBeUndefined();
    expect(byDomain(availableModules(profileWith('bd.company.read'))).flatMap((d) => d.items).every((m) => m.href)).toBe(true);
  });
});

describe('module courant : le plus précis gagne', () => {
  const modules = availableModules(profileWith(...MODULES.flatMap((m) => (m.permission ? [m.permission] : []))));
  it('une page enfant n\'allume pas le module parent (Sessions et Catalogue sont à `/training…`)', () => {
    expect(activeModule(modules, '/training')?.id).toBe('training');
    expect(activeModule(modules, '/training/sessions')?.id).toBe('sessions');
    expect(activeModule(modules, '/training/sessions/0198a1b2-0000-7000-8000-000000000001')?.id).toBe('sessions');
    expect(activeModule(modules, '/training/enrollments')?.id).toBe('enrollments');
    expect(activeModule(modules, '/training/learners')?.id).toBe('learners');
  });
  it('une fiche appartient à son module ; une page sans module (hub, compte) n\'en allume aucun ; un préfixe voisin ne compte pas', () => {
    expect(activeModule(modules, '/companies/123')?.id).toBe('companies');
    expect(activeModule(modules, '/')).toBeNull();
    expect(activeModule(modules, '/account')).toBeNull();
    expect(activeModule(modules, '/account/sessions')).toBeNull();
    expect(activeModule(modules, '/trainingx')).toBeNull();
    expect(activeModule(modules, '/admin/users')?.id).toBe('users');
  });
  it('un module non autorisé n\'est jamais le module courant', () => {
    expect(activeModule(availableModules(profileWith('bd.company.read')), '/training/sessions')).toBeNull();
  });
});

describe('coque et hub', () => {
  it('chaque domaine est un bouton repliable annoncé (aria-expanded, aria-controls) ; le domaine courant se rouvre à chaque page', () => {
    const shell = read('components/app-shell.tsx');
    expect(shell).toContain('aria-expanded={open}');
    expect(shell).toContain('aria-controls={listId}');
    expect(shell).toContain('active?.group');
    expect(shell).toContain('setClosedHere(null)');
    expect(shell).toContain('current={active?.id === m.id}'); // plus de `startsWith` qui allumait deux entrées
    expect(shell).not.toContain('pathname.startsWith(m.href');
  });
  it('en rail replié, toutes les entrées restent visibles (le domaine n\'est qu\'un séparateur)', () => {
    const shell = read('components/app-shell.tsx');
    expect(shell).toContain("'hidden flex-col gap-0.5 group-data-[nav=rail]/shell:min-[901px]:flex'");
    expect(shell).toContain('group-data-[nav=rail]/shell:min-[901px]:hidden');
  });
  it('le hub range les modules par domaine', () => {
    const hub = read('app/(app)/page.tsx');
    expect(hub).toContain('byDomain(available)');
    expect(hub).toContain('<h3 id={`domaine-${domain}`}');
  });
  it('le compte reste en pied de menu', () => {
    const shell = read('components/app-shell.tsx');
    expect(shell).toContain('href="/account"');
    expect(shell).toContain('Se déconnecter');
  });
});
