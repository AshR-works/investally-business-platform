import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTITY_NOUN, type EntityKind, entityHref } from '../lib/entity-links';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('adresses des fiches (D-NAV-3)', () => {
  it('chaque entité a une adresse de fiche construite à un seul endroit', () => {
    expect(entityHref('company', 'abc')).toBe('/companies/abc');
    expect(entityHref('contact', 'abc')).toBe('/contacts/abc');
    expect(entityHref('offer', 'abc')).toBe('/offers/abc');
    expect(entityHref('opportunity', 'abc')).toBe('/opportunities/abc');
  });
  it('l\'identifiant est encodé et chaque entité a un libellé de phrase', () => {
    expect(entityHref('offer', 'a/b ?')).toBe('/offers/a%2Fb%20%3F');
    for (const kind of ['company', 'contact', 'offer', 'opportunity'] as EntityKind[]) expect(ENTITY_NOUN[kind]).toBeTruthy();
  });
});

describe('fiches détaillées', () => {
  const SHEETS: [string, string, string][] = [
    ['contacts', 'contacts', 'contact'],
    ['offers', 'offers', 'offer'],
    ['opportunities', 'opportunities', 'opportunity'],
  ];
  it.each(SHEETS)('la fiche %s existe, lit l\'API par identifiant et affiche « introuvable » via la coque commune', (dir, api, kind) => {
    const path = `app/(app)/${dir}/[id]/page.tsx`;
    expect(existsSync(join(root, path))).toBe(true);
    const source = read(path);
    expect(source).toContain(`useEntity<`);
    expect(source).toContain(`'${api}'`);
    expect(source).toContain(`<SheetState kind="${kind}"`);
    expect(source).toContain('<EntitySheet');
    expect(source).toContain('<EntityLink kind="company"');
  });

  it('la coque : lecture seule, identifiant encodé, introuvable en alerte, retour à la liste', () => {
    const shell = read('components/entity-sheet.tsx');
    expect(shell).toContain('encodeURIComponent(id)');
    expect(shell).toContain('role="alert"');
    expect(shell).toContain('role="status"');
    expect(shell).toContain('← {listLabel}');
  });

  it('le lien précise où il mène pour les lecteurs d\'écran', () => {
    const link = read('components/entity-link.tsx');
    expect(link).toContain('aria-label={`Ouvrir la fiche de ${ENTITY_NOUN[kind]} ${label}`}');
  });

  it('la fiche d\'une offre n\'appelle les relances que si le droit de lecture existe', () => {
    const source = read('app/(app)/offers/[id]/page.tsx');
    expect(source).toContain("can(profile, 'bd.followup.read')");
    expect(source).toContain('if (!offerId || !canFollowups) return;');
    expect(source).toContain('PLANNED');
  });

  it('les liens vers d\'autres listes passent par le filtre d\'entreprise (D52)', () => {
    for (const dir of ['contacts', 'offers', 'opportunities']) expect(read(`app/(app)/${dir}/[id]/page.tsx`)).toContain("listFor('/");
  });
});

describe('les listes et panneaux pointent vers les fiches', () => {
  it.each([
    ['app/(app)/contacts/page.tsx', ['kind="contact"', 'kind="company"']],
    ['app/(app)/offers/page.tsx', ['kind="offer"', 'kind="company"']],
    ['app/(app)/opportunities/page.tsx', ['kind="opportunity"', 'kind="company"']],
    ['app/(app)/followups/page.tsx', ['kind="company"']],
    ['components/contacts/contacts-panel.tsx', ['kind="contact"']],
    ['components/offers/offers-panel.tsx', ['kind="offer"']],
    ['components/opportunities/opportunities-panel.tsx', ['kind="opportunity"']],
  ])('%s utilise EntityLink', (path, kinds) => {
    const source = read(path);
    expect(source).toContain('EntityLink');
    for (const k of kinds) expect(source).toContain(k);
    expect(source).not.toMatch(/href=\{`\/companies\/\$\{[a-z]\.companyId\}`\}/); // plus d'adresse de fiche écrite à la main
  });
});

describe('N4 : agréments et nouvelle inscription', () => {
  it('Agréments est un module du CRM, lu avec bd.approval.read, et sa fiche suit la coque commune', () => {
    expect(entityHref('approval', 'x')).toBe('/approvals/x');
    const sheet = read('app/(app)/approvals/[id]/page.tsx');
    expect(sheet).toContain("useEntity<Approval>('approvals')");
    expect(sheet).toContain('<SheetState kind="approval"');
    expect(sheet).toContain('<EntityLink kind="company"');
    expect(sheet).toContain('<EntityLink kind="opportunity"');
  });
  it('la liste filtre par état et par entreprise (adresse), propose le cycle selon l\'état et les droits', () => {
    const list = read('app/(app)/approvals/page.tsx');
    expect(list).toContain("'bd.approval.read'");
    expect(list).toContain('useCompanyContext()');
    expect(list).toContain('<CompanyContextBar ctx={ctx} section="Agréments" />');
    expect(list).toContain('ctx.companyId]);');
    expect(list).toContain('approvalActions(a, rights)');
    expect(list).toContain('<EntityLink kind="approval"');
  });
  it('la fiche entreprise renvoie vers la liste filtrée et vers la fiche de chaque agrément', () => {
    const panel = read('components/approvals/approvals-panel.tsx');
    expect(panel).toContain('/approvals?companyId=${company.id}');
    expect(panel).toContain('<EntityLink kind="approval"');
  });
  it('la page Inscriptions a un bouton « Nouvelle inscription » réservé au droit de création, qui recharge la file', () => {
    const page = read('app/(app)/training/enrollments/page.tsx');
    expect(page).toContain('ENROLLMENT_PERMISSIONS.enroll');
    expect(page).toContain('Nouvelle inscription');
    expect(page).toContain("dialog={{ kind: 'enroll' }}");
    expect(page).toContain('refreshKey={refreshKey}');
  });
});
