import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext, Visibility } from '../../iam';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Offer, OfferStatus } from '../domain/offer';
import { OFFER_REPOSITORY, OfferRepository } from '../domain/offer-repository';
import { PlannedFollowupsCloser } from './followup-closer';
import { OfferView, toOfferView } from './offer-view';

const NOT_FOUND_COMPANY = 'Entreprise introuvable';
const NOT_FOUND_OFFER = 'Offre introuvable';
const STALE = "L'offre a été modifiée par un autre utilisateur : rechargez-la avant de la modifier";

/** Entreprise visible de l'appelant pour cette permission, sinon « introuvable » (même réponse qu'un identifiant inexistant). */
export async function companyInScope(companies: CompanyRepository, id: string, access: AccessContext, permission: string): Promise<Company> {
  const company = await companies.findById(id);
  if (!company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_COMPANY);
  return company;
}

/** Offre et entreprise visibles de l'appelant (la visibilité d'une offre suit celle de son entreprise). */
export async function offerInScope(
  offers: OfferRepository, companies: CompanyRepository, id: string, access: AccessContext, permission: string,
): Promise<{ offer: Offer; company: Company }> {
  const offer = await offers.findById(id);
  const company = offer ? await companies.findById(offer.companyId) : null;
  if (!offer || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_OFFER);
  return { offer, company };
}

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses offres ne sont plus modifiables");
}

export interface RegisterOfferCommand {
  companyId: string;
  subject: string;
  amount: string | number;
  currency?: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/** Créer une offre (brouillon) : l'entreprise doit être dans la portée de l'appelant et non archivée ; référence attribuée ; audit. */
@Injectable()
export class RegisterOfferUseCase {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterOfferCommand): Promise<OfferView> {
    return this.unitOfWork.run(async () => {
      const company = await companyInScope(this.companies, command.companyId, command.access, 'bd.offer.create');
      assertWritable(company);
      const now = this.clock.now();
      // Les champs sont validés AVANT de consommer un numéro : une saisie refusée ne laisse pas de trou dans la numérotation.
      const draft = Offer.create({ ...command, id: this.ids.next(), reference: 'PROVISOIRE', now });
      const offer = Offer.create({ ...command, id: draft.id, reference: await this.offers.nextReference(now.getUTCFullYear()), now });
      await this.offers.save(offer);
      const view = toOfferView(offer, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Offer', entityId: offer.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface UpdateOfferCommand {
  id: string;
  version: number;
  subject?: string;
  amount?: string | number;
  currency?: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier un brouillon : portée de son entreprise, version lue, entreprise non archivée ; audit avant/après. */
@Injectable()
export class UpdateOfferUseCase {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UpdateOfferCommand): Promise<OfferView> {
    return this.unitOfWork.run(async () => {
      const { offer, company } = await offerInScope(this.offers, this.companies, command.id, command.access, 'bd.offer.update');
      assertWritable(company);
      if (offer.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const before = toOfferView(offer, company.name.value);
      offer.edit(command);
      await this.offers.save(offer);
      const after = toOfferView((await this.offers.findById(offer.id)) ?? offer, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Offer', entityId: offer.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

export type OfferAction = 'submit' | 'accept' | 'refuse' | 'withdraw';

/** Permission exigée par chaque action : retirer a son propre droit, les autres changements d'état relèvent de la modification. */
export const OFFER_ACTION_PERMISSION: Record<OfferAction, string> = {
  submit: 'bd.offer.update',
  accept: 'bd.offer.update',
  refuse: 'bd.offer.update',
  withdraw: 'bd.offer.withdraw',
};

/** Motif de l'annulation automatique des relances à faire, selon l'action qui ferme l'offre. */
const CLOSING_REASON: Partial<Record<OfferAction, string>> = {
  accept: "Offre acceptée par l'entreprise",
  refuse: "Offre refusée par l'entreprise",
  withdraw: 'Offre retirée',
};

export interface ChangeOfferStatusCommand {
  id: string;
  version: number;
  action: OfferAction;
  /** Motif, obligatoire pour retirer une offre. */
  reason?: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Changer l'état d'une offre (déposer, accepter, refuser, retirer) : portée, version lue, entreprise non archivée, transition permise ; audit. */
@Injectable()
export class ChangeOfferStatusUseCase {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly followups: PlannedFollowupsCloser,
  ) {}

  async execute(command: ChangeOfferStatusCommand): Promise<OfferView> {
    return this.unitOfWork.run(async () => {
      const { offer, company } = await offerInScope(this.offers, this.companies, command.id, command.access, OFFER_ACTION_PERMISSION[command.action]);
      assertWritable(company);
      if (offer.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const before = toOfferView(offer, company.name.value);
      const now = this.clock.now();
      if (command.action === 'submit') offer.submit(now);
      else if (command.action === 'accept') offer.accept(now);
      else if (command.action === 'refuse') offer.refuse(now);
      else offer.withdraw(command.reason, now);
      await this.offers.save(offer);
      const after = toOfferView((await this.offers.findById(offer.id)) ?? offer, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Offer', entityId: offer.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      // Plus de relance une fois que le client a répondu ou que l'offre est retirée : les relances à faire sont annulées.
      const closing = CLOSING_REASON[command.action];
      if (closing) await this.followups.cancelPlanned(offer, company.name.value, closing, command.actor, now);
      return after;
    });
  }
}

const MAX_PAGE_SIZE = 100;

/** Lecture d'une offre : hors de la portée de son entreprise, elle est « introuvable ». */
@Injectable()
export class GetOfferHandler {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<OfferView> {
    const { offer, company } = await offerInScope(this.offers, this.companies, query.id, query.access, 'bd.offer.read');
    return toOfferView(offer, company.name.value);
  }
}

/** Liste paginée des offres visibles ; filtrer par entreprise exige que cette entreprise soit dans la portée (sinon « introuvable »). */
@Injectable()
export class ListOffersHandler {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { page: number; pageSize: number; search?: string; companyId?: string; status?: string; visibility: Visibility; access: AccessContext }): Promise<Page<OfferView>> {
    if (query.companyId) await companyInScope(this.companies, query.companyId, query.access, 'bd.offer.read');
    const status = query.status && Object.values(OfferStatus).includes(query.status as OfferStatus) ? (query.status as OfferStatus) : undefined;
    const result = await this.offers.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      search: query.search?.trim() || undefined,
      companyId: query.companyId,
      status,
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => ({ ...toOfferView(i.offer, i.companyName), nextFollowupOn: i.nextFollowupOn })) };
  }
}
