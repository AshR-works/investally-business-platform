import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDomainOpen, toggleDomain, type OpenDomain } from '../lib/nav-state';
import { kindOf, MIN_REM } from '../lib/table-layout';
import { isOutside } from '../lib/use-dismiss';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** Lot A (2026-11-10) : observations du test manuel de la V1 sur l'agencement, les menus et la navigation. */

describe('lot A — navigation en accordéon, sans mémoire', () => {
  it('sans choix à la main, le domaine de la page courante est ouvert, et lui seul', () => {
    expect(isDomainOpen(null, 'CRM', 'CRM')).toBe(true);
    expect(isDomainOpen(null, 'CRM', 'Investudy')).toBe(false);
    expect(isDomainOpen(null, null, 'CRM')).toBe(false);
    expect(isDomainOpen(null, undefined, 'CRM')).toBe(false);
  });

  it('ouvrir un autre domaine referme celui de la page : une seule rubrique ouverte', () => {
    const next = toggleDomain(null, 'CRM', 'Investudy');
    expect(next).toBe('Investudy');
    expect(isDomainOpen(next, 'CRM', 'Investudy')).toBe(true);
    expect(isDomainOpen(next, 'CRM', 'CRM')).toBe(false);
    expect(isDomainOpen(next, 'CRM', 'Finance')).toBe(false);
  });

  it('un domaine ouvert se replie (tout est replié), un domaine replié s’ouvre', () => {
    expect(toggleDomain(null, 'CRM', 'CRM')).toBe('none');
    expect(isDomainOpen('none', 'CRM', 'CRM')).toBe(false);
    expect(isDomainOpen('none', 'CRM', 'Investudy')).toBe(false);
    expect(toggleDomain('none', 'CRM', 'CRM')).toBe('CRM');
    expect(toggleDomain('Investudy', 'CRM', 'Investudy')).toBe('none');
    expect(toggleDomain('Investudy', 'CRM', 'Finance')).toBe('Finance');
  });

  it('chaque suite de clics laisse au plus un domaine ouvert', () => {
    const domains = ['CRM', 'Investudy', 'Finance', 'Ressources humaines', 'Stocks', 'Reporting', 'Administration'] as const;
    let state: OpenDomain = null;
    for (const clicked of ['Investudy', 'Finance', 'Finance', 'CRM', 'Reporting', 'Administration', 'Administration']) {
      state = toggleDomain(state, 'CRM', clicked as (typeof domains)[number]);
      expect(domains.filter((d) => isDomainOpen(state, 'CRM', d)).length).toBeLessThanOrEqual(1);
    }
  });

  it('la coque ne mémorise plus rien dans le navigateur pour la navigation', () => {
    const shell = read('components/app-shell.tsx');
    expect(shell).not.toMatch(/localStorage/);
    expect(shell).not.toMatch(/investally-nav/);
  });
});

describe('lot A — navigation dépliée par-dessus le contenu', () => {
  const shell = read('components/app-shell.tsx');

  it('la mise en page ne dépend que de la Vue d’ensemble : dépliée ailleurs, la navigation ne déplace pas le contenu', () => {
    expect(shell).toContain("data-nav={hub ? 'full' : 'rail'}");
    expect(shell).toContain('const overlay = expanded && !hub;');
    expect(shell).toMatch(/NAV_OVERLAY = '[^']*min-\[901px\]:fixed/);
    expect(shell).toMatch(/NAV_STICKY = '[^']*min-\[901px\]:sticky/);
    expect(shell).toContain('${overlay ? NAV_OVERLAY : NAV_STICKY}');
  });

  it('se replie au clic en dehors et à Échap, et à chaque changement de page', () => {
    expect(shell).toContain('useDismiss(aside, overlay, () => setExpanded(false));');
    expect(shell).toMatch(/useEffect\(\(\) => \{\s*setDrawer\(false\);\s*setExpanded\(false\);\s*setManual\(null\);\s*\}, \[pathname\]\);/);
  });

  it('l’aspect (rail ou complet) suit l’état, pas la mise en page', () => {
    expect(shell).toContain('data-look={look}');
    expect(shell).toContain('group/nav');
    expect(shell).not.toContain('group-data-[nav=rail]/shell');
  });
});

describe('lot A — la pastille de l’utilisateur mène à « Mon compte »', () => {
  const shell = read('components/app-shell.tsx');
  it('un lien (pastille et nom) vers /account, nommé pour les lecteurs d’écran, avec la page courante signalée', () => {
    expect(shell).toContain('href="/account"');
    expect(shell).toContain('aria-label={`Mon compte : ${profile?.displayName ?? \'\'}`}');
    expect(shell).toContain("aria-current={pathname.startsWith('/account') ? 'page' : undefined}");
    expect(shell).toContain('{profile?.displayName}');
  });
});

describe('lot A — menus qui se referment au clic en dehors', () => {
  it('reconnaît un clic en dehors du conteneur, et seulement lui', () => {
    const inside = { nodeType: 1, name: 'dedans' };
    const outside = { nodeType: 1, name: 'dehors' };
    const container = { contains: (target: unknown) => target === inside };
    expect(isOutside(container, outside as unknown as EventTarget)).toBe(true);
    expect(isOutside(container, inside as unknown as EventTarget)).toBe(false);
    // Sans conteneur connu, sans cible, ou avec une cible qui n'est pas un nœud (la fenêtre) : jamais « en dehors ».
    expect(isOutside(null, outside as unknown as EventTarget)).toBe(false);
    expect(isOutside(container, null)).toBe(false);
    expect(isOutside(container, {} as EventTarget)).toBe(false);
  });

  it('le menu « Colonnes » utilise le comportement commun (clic en dehors, Échap, focus rendu au bouton)', () => {
    const page = read('app/(app)/companies/page.tsx');
    expect(page).toContain("import { useDismiss } from '../../../lib/use-dismiss';");
    expect(page).toMatch(/useDismiss\(ref, open, \(reason\) => \{[\s\S]*ref\.current\.open = false;[\s\S]*reason === 'escape'/);
    expect(page).toContain('onToggle={(event) => setOpen(');
  });

  it('le comportement commun écoute le clic et Échap seulement quand le menu est ouvert, puis se détache', () => {
    const hook = read('lib/use-dismiss.ts');
    expect(hook).toContain('if (!active) return;');
    expect(hook).toContain("document.addEventListener('pointerdown', onPointer)");
    expect(hook).toContain("document.addEventListener('keydown', onKey)");
    expect(hook).toContain("document.removeEventListener('pointerdown', onPointer)");
    expect(hook).toContain("document.removeEventListener('keydown', onKey)");
    expect(hook).toContain("event.key === 'Escape'");
  });
});

describe('lot A — en-tête de page et barre d’outils', () => {
  it('les fiches (EntitySheet) empilent le titre et les actions : bloc pleine largeur, puis la rangée d’actions', () => {
    expect(read('components/entity-sheet.tsx')).toContain('actions={actions} stacked />');
    const header = read('components/data/page-header.tsx');
    expect(header).toContain('stacked = false');
    expect(header).toMatch(/stacked \? 'flex-col' : 'flex-wrap items-end'/);
    expect(header).toMatch(/stacked \? 'max-w-none' : 'max-w-prose'/);
  });

  it('les fiches qui utilisent PageHeader directement (entreprise, session de formation) sont empilées elles aussi', () => {
    for (const page of ['app/(app)/companies/[id]/page.tsx', 'app/(app)/training/sessions/[id]/page.tsx']) expect(read(page)).toMatch(/<PageHeader\s+stacked\b/);
  });

  it('les pages de liste gardent leurs actions à droite du titre', () => {
    for (const page of ['app/(app)/companies/page.tsx', 'app/(app)/offers/page.tsx', 'app/(app)/ambassadors/page.tsx']) expect(read(page)).not.toMatch(/<PageHeader[^>]*\bstacked\b/);
  });

  it('la barre d’outils neutralise les marges du style global des champs : tous les contrôles ont la même ligne médiane et la même hauteur', () => {
    const toolbar = read('components/data/toolbar.tsx');
    expect(toolbar).toContain('[&_label]:mb-0');
    expect(toolbar).toContain('[&_select]:mt-0');
    expect(toolbar).toContain('[&_select]:h-10');
    expect(toolbar).toMatch(/\[&_input\[type=search\]\]:mt-0/);
    // La recherche et le bouton « Colonnes » font 40 px (h-10) : la même hauteur que les listes.
    expect(toolbar).toMatch(/h-10 min-w-48/);
    expect(read('app/(app)/companies/page.tsx')).toMatch(/inline-flex h-10 cursor-pointer/);
  });
});

describe('lot A — nature des colonnes déduite de l’en-tête (toutes les colonnes de l’application)', () => {
  // Les en-têtes réels de l'application : chacun est lu dans les pages et composants, jamais recopié à la main.
  const files = [
    'app/(app)/companies/page.tsx', 'app/(app)/contacts/page.tsx', 'app/(app)/offers/page.tsx', 'app/(app)/followups/page.tsx', 'app/(app)/ambassadors/page.tsx',
    'app/(app)/admin/users/page.tsx', 'app/(app)/account/sessions/page.tsx', 'app/(app)/hr/page.tsx', 'app/(app)/hr/employees/page.tsx', 'app/(app)/commissions/page.tsx',
    'app/(app)/approvals/page.tsx', 'app/(app)/opportunities/page.tsx', 'app/(app)/training/page.tsx', 'app/(app)/training/learners/page.tsx', 'app/(app)/training/sessions/page.tsx',
    'app/(app)/training/enrollments/page.tsx',
  ];
  const headers = [...new Set(files.flatMap((file) => [...read(file).matchAll(/header: '([^']+)'/g)].map((m) => m[1]!)))];

  it('les en-têtes de l’application sont trouvés', () => {
    expect(headers.length).toBeGreaterThan(40);
    expect(headers).toEqual(expect.arrayContaining(['Téléphone', 'Pays', 'État', 'Entreprise']));
  });

  it('ce que l’on reconnaît comme date, téléphone, montant, état ou référence a une largeur minimale', () => {
    for (const header of headers) {
      const kind = kindOf(header);
      expect([header, kind === 'text' ? 0 : MIN_REM[kind] > 0]).toEqual([header, kind === 'text' ? 0 : true]);
    }
  });

  it('les colonnes de date, de téléphone, de montant et d’état de l’application sont reconnues', () => {
    const expected: Record<string, string> = {
      'Téléphone': 'phone', 'Créée le': 'date', 'Déposée le': 'date', 'Prochaine relance': 'date', 'Valeur': 'money', 'Montant': 'money', 'État': 'status', 'Statut': 'status', 'Référence': 'reference', 'Pays': 'country', 'Dernière connexion': 'datetime',
    };
    for (const [header, kind] of Object.entries(expected)) if (headers.includes(header)) expect([header, kindOf(header)]).toEqual([header, kind]);
  });
});
