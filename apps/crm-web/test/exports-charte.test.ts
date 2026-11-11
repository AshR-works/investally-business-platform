import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('exports imprimables — charte graphique des documents administratifs', () => {
  it('la fiche d’offre propose « Exporter l’offre » à qui la voit, via la route d’export tracée, et annonce une erreur', () => {
    const page = read('app/(app)/offers/[id]/page.tsx');
    expect(page).toContain('Exporter l’offre');
    expect(page).toContain('openOfferSheet(id)');
    expect(page).toMatch(/exportError && <p role="alert"/);
    const lib = read('lib/export-sheet.ts');
    expect(lib).toContain('`/offers/${offerId}/export`');
    expect(lib).toContain('`/companies/${companyId}/export`');
  });
});
