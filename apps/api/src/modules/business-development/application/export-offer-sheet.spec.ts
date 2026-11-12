import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { Offer } from '../domain/offer';
import { InMemoryOffers } from '../../../../test/support/in-memory-offers';
import { ExportOfferSheetHandler } from './export-offer-sheet.query';
import { formatAmount } from './charter/charter';
import { renderOfferSheet } from './offer-sheet';
import { OfferView } from './offer-view';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's-7', ipAddress: '10.0.0.5', device: 'jest' };
const as = (role: RoleCode, actorId: string): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: [] });
const now = new Date('2026-11-10T09:00:00Z');

const view = (patch: Partial<OfferView> = {}): OfferView => ({
  id: '00000000-0000-7000-8000-000000000001', reference: 'OFF-2026-0007', companyId: 'c1', companyName: 'Banque Kasai', subject: 'Formation « Analyse financière »',
  amount: '6797250.00', currency: 'XAF', status: 'SUBMITTED', note: '3 jours, Douala', submittedAt: '2026-11-09T08:00:00.000Z', decidedAt: null, withdrawnReason: null,
  createdAt: '2026-11-05T08:00:00.000Z', version: 2, ...patch,
});

describe('offre imprimable — charte graphique et sécurité', () => {
  it('reprend le formalisme du devis : titre OFFRE, numéro, tableau noir, total, cadre Bon pour accord, pied de page légal', () => {
    const html = renderOfferSheet(view(), now);
    expect(html).toContain('<h1>OFFRE</h1>');
    expect(html).toContain('N° OFF-2026-0007');
    expect(html).toContain('class="lignes"');
    expect(html).toContain('class="total"');
    expect(html).toContain('Bon pour accord');
    expect(html).toContain('RC : CM-DLA-01-2026-B14-00033');
    expect(html).toContain('Banque Kasai');
    expect(html.replace(/\s/g, ' ')).toContain('6 797 250 XAF');
  });

  it('ne calcule ni ne mentionne aucune taxe : le montant est celui de l\'offre', () => {
    expect(renderOfferSheet(view(), now).replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '')).not.toMatch(/TVA|TTC/);
  });

  it('formate les montants (milliers, décimales seulement si utiles)', () => {
    expect(formatAmount('4500000.00')).toBe('4 500 000');
    expect(formatAmount('1250.5')).toBe('1 250,50');
  });

  it('échappe tout texte saisi, et ne contient ni script ni ressource externe', () => {
    const html = renderOfferSheet(view({ subject: '<script>x()</script>', note: '"><img src=x onerror=y>', companyName: '<b>Acme</b>', withdrawnReason: '<i>motif</i>' }), now);
    expect(html).not.toMatch(/<script|<link|<iframe|href=|@import|url\(/i);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;x()&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Acme&lt;/b&gt;');
    for (const source of [...html.matchAll(/src="([^"]*)"/g)].map((m) => m[1])) expect(source).toMatch(/^data:image\/png;base64,/);
  });

  it('les dates absentes s\'affichent « — » et le motif de retrait n\'apparaît que s\'il existe', () => {
    const draft = renderOfferSheet(view({ status: 'DRAFT', submittedAt: null }), now);
    expect(draft).toContain('<span class="muted">—</span>');
    expect(draft).not.toContain('Motif du retrait');
    expect(renderOfferSheet(view({ status: 'WITHDRAWN', withdrawnReason: 'Budget gelé' }), now)).toContain('Motif du retrait');
  });
});

function build(recorder: { record: (r: AuditRecord) => Promise<void> } | null = null) {
  const companies = new InMemoryCompanies();
  const offers = new InMemoryOffers(companies);
  const audit: AuditRecord[] = [];
  const company = Company.register({ id: '00000000-0000-7000-8000-0000000000c1', name: 'Acme', ownerUserId: 'am1', now });
  companies.items.push(company);
  const offer = Offer.create({ id: '00000000-0000-7000-8000-0000000000f1', reference: 'OFF-2026-0001', companyId: company.id, subject: 'Formation', amount: 1000, currency: 'XAF', now });
  offers.items.push(offer);
  const exporter = new ExportOfferSheetHandler(offers, companies, recorder ?? { record: async (r: AuditRecord) => { audit.push(r); } }, { now: () => now });
  return { exporter, audit, offer };
}

describe('export de l\'offre — portée et audit', () => {
  it('le propriétaire exporte ; l\'export est tracé (qui, session, d\'où) sans recopier le contenu', async () => {
    const { exporter, audit, offer } = build();
    const out = await exporter.execute({ id: offer.id, access: as(RoleCode.AccountManager, 'am1'), actor });
    expect(out.html).toContain('<h1>OFFRE</h1>');
    expect(out.fileName).toBe('OFF-2026-0001.html');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: AuditAction.Export, entityType: 'Offer', entityId: offer.id, actor: { sessionId: 's-7', ipAddress: '10.0.0.5' } });
    expect(audit[0].newValue).toEqual({ document: 'offre', reference: 'OFF-2026-0001', status: 'DRAFT' });
  });

  it('IDOR : l\'offre d\'un collègue est « introuvable » (même réponse qu\'un identifiant inexistant), sans trace', async () => {
    const { exporter, audit, offer } = build();
    const real = await exporter.execute({ id: offer.id, access: as(RoleCode.AccountManager, 'am2'), actor }).catch((e) => e);
    const missing = await exporter.execute({ id: '00000000-0000-7000-8000-00000000dead', access: as(RoleCode.AccountManager, 'am2'), actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(audit).toHaveLength(0);
  });

  it('si l\'audit échoue, rien n\'est remis', async () => {
    const { exporter, offer } = build({ record: async () => { throw new Error('audit indisponible'); } });
    await expect(exporter.execute({ id: offer.id, access: as(RoleCode.AccountManager, 'am1'), actor })).rejects.toThrow('audit indisponible');
  });
});
