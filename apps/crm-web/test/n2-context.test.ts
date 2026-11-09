import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agendaParams } from '../lib/appointments';
import { listFor } from '../lib/company-context';
import { followupListParams } from '../lib/followups';
import { opportunityListParams } from '../lib/opportunities';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const COMPANY = '0198a1b2-0000-7000-8000-00000000c001';

describe('filtre d\'entreprise dans les requêtes (D52)', () => {
  it('chaque liste transmet `companyId` à l\'API quand l\'adresse le porte, et seulement alors', () => {
    expect(agendaParams({ from: '2026-11-01', to: '2026-11-30' }, '', COMPANY).get('companyId')).toBe(COMPANY);
    expect(agendaParams({ from: '2026-11-01', to: '2026-11-30' }, '').has('companyId')).toBe(false);
    expect(opportunityListParams('all' as never, '', COMPANY).get('companyId')).toBe(COMPANY);
    expect(opportunityListParams('all' as never, '').has('companyId')).toBe(false);
    expect(followupListParams('todo' as never, 1, 20, undefined, COMPANY).get('companyId')).toBe(COMPANY);
    expect(followupListParams('todo' as never, 1, 20).has('companyId')).toBe(false);
  });

  it('les filtres existants restent : la recherche et le type ne sont pas perdus', () => {
    const params = agendaParams({ from: '2026-11-01', to: '2026-11-30' }, 'VISIT', COMPANY);
    expect([params.get('from'), params.get('to'), params.get('type'), params.get('companyId')]).toEqual(['2026-11-01', '2026-11-30', 'VISIT', COMPANY]);
    expect(opportunityListParams('all' as never, ' Banque ', COMPANY).get('search')).toBe('Banque');
  });

  it('l\'adresse d\'une liste filtrée est construite à un seul endroit', () => {
    expect(listFor('/offers', COMPANY)).toBe(`/offers?companyId=${COMPANY}`);
    expect(listFor('/agenda', 'a b')).toBe('/agenda?companyId=a%20b');
  });
});

describe('pages et fiche entreprise', () => {
  const PAGES: [string, string][] = [
    ['offers', 'Offres'], ['contacts', 'Contacts'], ['commissions', 'Commissions'], ['followups', 'Relances'], ['opportunities', 'Opportunités'], ['agenda', 'Agenda'],
  ];
  it.each(PAGES)('la page %s lit le contexte, filtre, affiche le bandeau « %s » et se recharge quand le contexte change', (name, section) => {
    const source = read(`app/(app)/${name}/page.tsx`);
    expect(source).toContain('useCompanyContext()');
    expect(source).toContain(`<CompanyContextBar ctx={ctx} section="${section}" />`);
    expect(source).toContain('ctx.companyId]);'); // dans les dépendances du chargement
    if (['offers', 'contacts', 'commissions', 'followups'].includes(name)) expect(source).toContain('useEffect(() => setPage(1), [ctx.companyId]);');
  });

  it('la fiche entreprise ouvre des listes filtrées, pas les listes complètes', () => {
    expect(read('components/opportunities/opportunities-panel.tsx')).toContain('/opportunities?companyId=${company.id}');
    expect(read('components/appointments/appointments-panel.tsx')).toContain('/agenda?companyId=${company.id}');
    expect(read('components/offers/offers-panel.tsx')).toContain('/offers?companyId=${company.id}');
    expect(read('components/contacts/contacts-panel.tsx')).toContain('/contacts?companyId=${company.id}');
    for (const f of ['opportunities/opportunities-panel', 'appointments/appointments-panel']) expect(read(`components/${f}.tsx`)).not.toMatch(/href="\/(agenda|opportunities)"/);
  });

  it('le bandeau : fil d\'Ariane, pastille retirable annoncée, explication d\'une entreprise introuvable', () => {
    const bar = read('components/company-context-bar.tsx');
    expect(bar).toContain('aria-label="Fil d’Ariane"');
    expect(bar).toContain('aria-current="page"');
    expect(bar).toContain('role="status"');
    expect(bar).toContain('Retirer le filtre sur l’entreprise');
    expect(bar).toContain('role="alert"');
    expect(bar).toContain('Voir toutes les entreprises');
    expect(bar).toContain('if (!ctx.companyId) return null;');
  });

  it('le contexte est lu dans l\'adresse et ne garde que le reste de la requête quand on le retire', () => {
    const hook = read('lib/company-context.ts');
    expect(hook).toContain("search.get('companyId')");
    expect(hook).toContain("params.delete('companyId')");
    expect(hook).toContain('hors de votre périmètre');
  });
});
