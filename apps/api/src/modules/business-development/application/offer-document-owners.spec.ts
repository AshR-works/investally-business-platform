import { Page } from '../../../shared-kernel';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { InMemoryOffers } from '../../../../test/support/in-memory-offers';
import { InMemoryReceipts } from '../../../../test/support/in-memory-receipts';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { Offer } from '../domain/offer';
import { Receipt } from '../domain/receipt';
import { OFFER_OWNER_TYPE, OfferDocumentOwnerResolver, RECEIPT_OWNER_TYPE, ReceiptDocumentOwnerResolver } from './offer-document-owners';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-04T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const offers = new InMemoryOffers(companies);
  const receipts = new InMemoryReceipts();
  companies.items.push(Company.register({ id: 'c1', name: 'Atlas', ownerUserId: 'am1', now }));
  const offer = Offer.create({ id: 'o1', reference: 'OFF-2026-0001', companyId: 'c1', subject: 'Formation', amount: '100', now });
  offer.submit(now);
  offers.items.push(offer);
  const receipt = Receipt.register({ id: 'r1', offerId: 'o1', receivedOn: '2026-11-04', receivedBy: 'Alain', offerSubmittedAt: now, now });
  receipts.items.push(receipt);
  const registered: Record<string, unknown> = {};
  const registry = { register: (type: string, resolver: unknown) => { registered[type] = resolver; }, resolver: () => null, types: () => [] };
  const offerOwner = new OfferDocumentOwnerResolver(offers, companies, registry);
  const receiptOwner = new ReceiptDocumentOwnerResolver(receipts, offers, companies, registry);
  return { offerOwner, receiptOwner, registered };
}

describe('Propriétaires de documents : offres et décharges', () => {
  it('se déclarent au registre des documents au démarrage', () => {
    const w = build();
    w.offerOwner.onModuleInit();
    w.receiptOwner.onModuleInit();
    expect(Object.keys(w.registered).sort()).toEqual([OFFER_OWNER_TYPE, RECEIPT_OWNER_TYPE].sort());
  });
  it('résolvent le propriétaire de l’entreprise pour qui peut lire l’offre ou la décharge', async () => {
    const w = build();
    for (const access of [as(RoleCode.AccountManager, 'am1'), as(RoleCode.HeadOfSales, 'chef', ['am1']), as(RoleCode.Direction, 'dir')]) {
      expect(await w.offerOwner.resolve('o1', access)).toEqual({ ownerUserId: 'am1' });
      expect(await w.receiptOwner.resolve('r1', access)).toEqual({ ownerUserId: 'am1' });
    }
  });
  it('ne résolvent rien hors de la portée, sans le droit de lecture, ou pour un objet inexistant', async () => {
    const w = build();
    for (const access of [as(RoleCode.AccountManager, 'am2'), as(RoleCode.HeadOfSales, 'autre', ['am2']), as(RoleCode.Support, 'sup'), as(RoleCode.Finance, 'fin')]) {
      expect(await w.offerOwner.resolve('o1', access)).toBeNull();
      expect(await w.receiptOwner.resolve('r1', access)).toBeNull();
    }
    expect(await w.offerOwner.resolve('inconnue', as(RoleCode.AccountManager, 'am1'))).toBeNull();
    expect(await w.receiptOwner.resolve('inconnue', as(RoleCode.AccountManager, 'am1'))).toBeNull();
  });
});
