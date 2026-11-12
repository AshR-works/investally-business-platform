import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Offer, OfferStatus } from '../domain/offer';
import { OFFER_REPOSITORY, OfferRepository } from '../domain/offer-repository';
import { Receipt, ReceiptStatus } from '../domain/receipt';
import { RECEIPT_REPOSITORY, ReceiptRepository } from '../domain/receipt-repository';
import { offerInScope } from './offer-use-cases';
import { toOfferView } from './offer-view';
import { ReceiptView, toReceiptView } from './receipt-view';

const NOT_FOUND_RECEIPT = 'Décharge introuvable';
const STALE = 'La décharge a été modifiée par un autre utilisateur : rechargez-la avant de la modifier';

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses décharges ne sont plus modifiables");
}

/** Décharge, offre et entreprise visibles de l'appelant : la visibilité d'une décharge suit celle de l'entreprise de son offre. */
async function receiptInScope(
  receipts: ReceiptRepository, offers: OfferRepository, companies: CompanyRepository, id: string, access: AccessContext, permission: string,
): Promise<{ receipt: Receipt; offer: Offer; company: Company }> {
  const receipt = await receipts.findById(id);
  const offer = receipt ? await offers.findById(receipt.offerId) : null;
  const company = offer ? await companies.findById(offer.companyId) : null;
  if (!receipt || !offer || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_RECEIPT);
  return { receipt, offer, company };
}

export interface RegisterReceiptCommand {
  offerId: string;
  receivedOn: string;
  receivedBy: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Enregistrer la décharge d'une offre DÉPOSÉE : portée de son entreprise, entreprise non archivée, une seule décharge valide ;
 * l'offre passe à « décharge reçue ». Les deux écritures et leurs traces d'audit sont dans la même transaction.
 */
@Injectable()
export class RegisterReceiptUseCase {
  constructor(
    @Inject(RECEIPT_REPOSITORY) private readonly receipts: ReceiptRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterReceiptCommand): Promise<ReceiptView> {
    return this.unitOfWork.run(async () => {
      const { offer, company } = await offerInScope(this.offers, this.companies, command.offerId, command.access, 'bd.receipt.create');
      assertWritable(company);
      if (offer.status === OfferStatus.ReceiptReceived) throw new DomainError('CONFLICT', 'Cette offre a déjà une décharge valide');
      if (offer.status !== OfferStatus.Submitted) {
        throw new DomainError('INVARIANT_VIOLATION', "Seule une offre déposée attend sa décharge : déposez d'abord l'offre");
      }
      const now = this.clock.now();
      const receipt = Receipt.register({ id: this.ids.next(), offerId: offer.id, receivedOn: command.receivedOn, receivedBy: command.receivedBy, offerSubmittedAt: offer.submittedAt, now });
      const before = toOfferView(offer, company.name.value);
      offer.receiptReceived();
      await this.receipts.save(receipt);
      await this.offers.save(offer);
      const after = toOfferView((await this.offers.findById(offer.id)) ?? offer, company.name.value);
      const view = toReceiptView(receipt, offer.reference);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Receipt', entityId: receipt.id, action: AuditAction.Create, newValue: { ...view } });
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Offer', entityId: offer.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return view;
    });
  }
}

export interface CancelReceiptCommand {
  id: string;
  version: number;
  reason?: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Annuler une décharge (saisie erronée, mauvais fichier) avec un motif : portée, version lue, entreprise non archivée ; l'offre
 * redevient « déposée » et attend sa décharge. Impossible une fois que le client a répondu ou que l'offre est retirée.
 */
@Injectable()
export class CancelReceiptUseCase {
  constructor(
    @Inject(RECEIPT_REPOSITORY) private readonly receipts: ReceiptRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CancelReceiptCommand): Promise<ReceiptView> {
    return this.unitOfWork.run(async () => {
      const { receipt, offer, company } = await receiptInScope(this.receipts, this.offers, this.companies, command.id, command.access, 'bd.receipt.update');
      assertWritable(company);
      if (receipt.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const before = toReceiptView(receipt, offer.reference);
      const offerBefore = toOfferView(offer, company.name.value);
      receipt.cancel(command.reason, this.clock.now());
      if (offer.status !== OfferStatus.ReceiptReceived) {
        throw new DomainError('INVARIANT_VIOLATION', "La décharge ne peut plus être annulée : l'offre a déjà reçu une réponse ou a été retirée");
      }
      offer.receiptCancelled();
      await this.receipts.save(receipt);
      await this.offers.save(offer);
      const after = toReceiptView((await this.receipts.findById(receipt.id)) ?? receipt, offer.reference);
      const offerAfter = toOfferView((await this.offers.findById(offer.id)) ?? offer, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Receipt', entityId: receipt.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Offer', entityId: offer.id, action: AuditAction.Update, oldValue: { ...offerBefore }, newValue: { ...offerAfter } });
      return after;
    });
  }
}

/** Lecture d'une décharge : hors de la portée de son entreprise, elle est « introuvable ». */
@Injectable()
export class GetReceiptHandler {
  constructor(
    @Inject(RECEIPT_REPOSITORY) private readonly receipts: ReceiptRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<ReceiptView> {
    const { receipt, offer } = await receiptInScope(this.receipts, this.offers, this.companies, query.id, query.access, 'bd.receipt.read');
    return toReceiptView(receipt, offer.reference);
  }
}

/** Décharges d'une offre (annulées comprises) ; l'offre doit être dans la portée de l'appelant, sinon « introuvable ». */
@Injectable()
export class ListReceiptsHandler {
  constructor(
    @Inject(RECEIPT_REPOSITORY) private readonly receipts: ReceiptRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { offerId: string; access: AccessContext }): Promise<ReceiptView[]> {
    const { offer } = await offerInScope(this.offers, this.companies, query.offerId, query.access, 'bd.receipt.read');
    const rows = await this.receipts.listByOffer(offer.id);
    return rows.map((r) => toReceiptView(r, offer.reference));
  }
}

export { ReceiptStatus };
