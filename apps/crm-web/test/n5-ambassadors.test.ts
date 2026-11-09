import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AMBASSADOR_STATE_FILTERS, ambassadorActions, archiveReasonProblem, isArchived } from '../lib/ambassadors';
import { entityHref } from '../lib/entity-links';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('archivage réversible des ambassadeurs (N5)', () => {
  it('un actif se modifie et s’archive ; un archivé est gelé et ne peut que se réactiver ; sans droit, aucune action', () => {
    expect(ambassadorActions({ status: 'ACTIVE' }, true)).toEqual(['edit', 'archive']);
    expect(ambassadorActions({ status: 'ARCHIVED' }, true)).toEqual(['reactivate']);
    expect(ambassadorActions({ status: 'ACTIVE' }, false)).toEqual([]);
    expect(ambassadorActions({ status: 'ARCHIVED' }, false)).toEqual([]);
    for (const a of ['edit', 'archive', 'reactivate'] as const) expect(['edit', 'archive', 'reactivate']).toContain(a);
  });
  it('jamais de suppression : aucune action « supprimer » n’existe', () => {
    const all = [...ambassadorActions({ status: 'ACTIVE' }, true), ...ambassadorActions({ status: 'ARCHIVED' }, true)];
    expect(all.some((a) => /delete|remove|supprim/i.test(a))).toBe(false);
    expect(read('app/(app)/ambassadors/page.tsx')).not.toMatch(/method: 'DELETE'|Supprimer/);
  });
  it('la liste s’ouvre sur les actifs, propose archivés et tous', () => {
    expect(AMBASSADOR_STATE_FILTERS.map((f) => f.value)).toEqual(['ACTIVE', 'ARCHIVED', '']);
    expect(isArchived({ status: 'ARCHIVED' })).toBe(true);
    expect(isArchived({ status: 'ACTIVE' })).toBe(false);
  });
  it('le motif est facultatif, 500 caractères au plus', () => {
    expect(archiveReasonProblem('')).toBeNull();
    expect(archiveReasonProblem('x'.repeat(500))).toBeNull();
    expect(archiveReasonProblem('x'.repeat(501))).toMatch(/500/);
  });
  it('la fenêtre envoie la version lue, le motif seulement à l’archivage, et rappelle que c’est réversible', () => {
    const dialog = read('components/ambassadors/ambassador-status-dialog.tsx');
    expect(dialog).toContain('/ambassadors/${ambassador.id}/status');
    expect(dialog).toContain('version: ambassador.version');
    expect(dialog).toContain('archiving && reason.trim()');
    expect(dialog).toContain('vous pourrez le réactiver');
    expect(dialog).toContain('Rien n’est supprimé');
  });
});

describe('ambassadeurs : page, filtre d’entreprise et fiche', () => {
  const page = read('app/(app)/ambassadors/page.tsx');
  it('la page filtre par état et par entreprise (adresse) et recharge quand ils changent', () => {
    expect(page).toContain("useState('ACTIVE')");
    expect(page).toContain("params.set('status', state)");
    expect(page).toContain('useCompanyContext()');
    expect(page).toContain('<CompanyContextBar ctx={ctx} section="Ambassadeurs" />');
    expect(page).toContain('state, ctx.companyId]);');
    expect(page).toContain('useEffect(() => setPage(1), [ctx.companyId]);');
  });
  it('le nom mène à la fiche, l’entreprise à sa fiche', () => {
    expect(entityHref('ambassador', 'x')).toBe('/ambassadors/x');
    expect(page).toContain('<EntityLink kind="ambassador"');
    expect(page).toContain('<EntityLink kind="company"');
  });
  it('la fiche montre l’état, la date et le motif d’archivage via la coque commune', () => {
    const sheet = read('app/(app)/ambassadors/[id]/page.tsx');
    expect(sheet).toContain("useEntity<Ambassador>('ambassadors')");
    expect(sheet).toContain('<SheetState kind="ambassador"');
    expect(sheet).toContain('Motif d’archivage');
    expect(sheet).toContain('Archivé le');
  });
});

describe('N5 : clonage d\'offre et fiche apprenant', () => {
  it('cloner est proposé avec le droit de créer, pour tout état ; jamais sans', async () => {
    const { availableActions, OFFER_ACTION_LABEL } = await import('../lib/offers');
    const rights = { update: true, withdraw: true };
    for (const status of ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REFUSED', 'WITHDRAWN']) {
      expect(availableActions(status, { ...rights, create: true })).toContain('clone');
      expect(availableActions(status, rights)).not.toContain('clone');
      expect(availableActions(status, { ...rights, create: false })).not.toContain('clone');
    }
    expect(OFFER_ACTION_LABEL.clone).toBe('Cloner en nouveau brouillon');
  });
  it('la fenêtre appelle POST /offers/:id/clone, explique ce qui est repris, puis ouvre la fiche du brouillon', () => {
    const dialogs = read('components/offers/offer-dialogs.tsx');
    expect(dialogs).toContain('/offers/${offer.id}/clone');
    expect(dialogs).toContain('router.push(`/offers/${created.id}`)');
    expect(dialogs).toContain('même objet, même montant');
    expect(dialogs).toContain('l’offre d’origine ne change pas');
    const sheet = read('app/(app)/offers/[id]/page.tsx');
    expect(sheet).toContain("can(profile, 'bd.offer.create')");
    expect(sheet).toContain("kind: 'clone'");
  });
  it('la fiche apprenant lit l\'apprenant et ses inscriptions (si le droit existe) ; la liste y mène', () => {
    expect(entityHref('learner', 'x')).toBe('/training/learners/x');
    const sheet = read('app/(app)/training/learners/[id]/page.tsx');
    expect(sheet).toContain("useEntity<Learner>('learners')");
    expect(sheet).toContain('/enrollments?learnerId=');
    expect(sheet).toContain('if (!learnerId || !canEnrollments) return;');
    expect(sheet).toContain('<SheetState kind="learner"');
    const list = read('app/(app)/training/learners/page.tsx');
    expect(list).toContain('<EntityLink kind="learner"');
    expect(list).toContain('<EntityLink kind="company"');
  });
});
