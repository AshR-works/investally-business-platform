import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext, Visibility } from '../../iam';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Followup, FollowupStatus, MAX_FOLLOWUPS_PER_OFFER } from '../domain/followup';
import { FOLLOWUP_REPOSITORY, FollowupDue, FollowupRepository } from '../domain/followup-repository';
import { Offer } from '../domain/offer';
import { OFFER_REPOSITORY, OfferRepository } from '../domain/offer-repository';
import { FollowupView, toFollowupView } from './followup-view';
import { companyInScope, offerInScope } from './offer-use-cases';

const NOT_FOUND = 'Relance introuvable';
const STALE = 'La relance a été modifiée par un autre utilisateur : rechargez-la avant de la modifier';

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses relances ne sont plus modifiables");
}

const context = (offer: Offer, company: Company) => ({ offerReference: offer.reference, companyId: company.id, companyName: company.name.value });

/** Relance, offre et entreprise visibles de l'appelant : la visibilité d'une relance suit celle de l'entreprise de son offre. */
async function followupInScope(
  followups: FollowupRepository, offers: OfferRepository, companies: CompanyRepository, id: string, access: AccessContext, permission: string,
): Promise<{ followup: Followup; offer: Offer; company: Company }> {
  const followup = await followups.findById(id);
  const offer = followup ? await offers.findById(followup.offerId) : null;
  const company = offer ? await companies.findById(offer.companyId) : null;
  if (!followup || !offer || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  return { followup, offer, company };
}

export interface PlanFollowupCommand {
  offerId: string;
  dueOn: string;
  channel: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Planifier une relance sur une offre EN COURS (déposée ou décharge reçue) : portée de son entreprise, entreprise non archivée,
 * au plus trois relances par offre ; l'échéance ne peut pas être dans le passé ; audit.
 */
@Injectable()
export class PlanFollowupUseCase {
  constructor(
    @Inject(FOLLOWUP_REPOSITORY) private readonly followups: FollowupRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: PlanFollowupCommand): Promise<FollowupView> {
    return this.unitOfWork.run(async () => {
      const { offer, company } = await offerInScope(this.offers, this.companies, command.offerId, command.access, 'bd.followup.create');
      assertWritable(company);
      if (!offer.isOpen) throw new DomainError('INVARIANT_VIOLATION', "Une relance n'a de sens que pour une offre déposée qui n'a pas encore reçu de réponse");
      const now = this.clock.now();
      const followup = Followup.plan({ id: this.ids.next(), offerId: offer.id, dueOn: command.dueOn, channel: command.channel, note: command.note, now });
      if ((await this.followups.countActiveByOffer(offer.id)) >= MAX_FOLLOWUPS_PER_OFFER) {
        throw new DomainError('INVARIANT_VIOLATION', `Une offre reçoit au plus ${MAX_FOLLOWUPS_PER_OFFER} relances : terminez ou annulez une relance existante`);
      }
      await this.followups.save(followup);
      const view = toFollowupView(followup, context(offer, company), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Followup', entityId: followup.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface UpdateFollowupCommand {
  id: string;
  version: number;
  dueOn?: string;
  channel?: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier une relance À FAIRE : portée, version lue, entreprise non archivée ; audit avant/après. */
@Injectable()
export class UpdateFollowupUseCase {
  constructor(
    @Inject(FOLLOWUP_REPOSITORY) private readonly followups: FollowupRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: UpdateFollowupCommand): Promise<FollowupView> {
    return this.unitOfWork.run(async () => {
      const { followup, offer, company } = await followupInScope(this.followups, this.offers, this.companies, command.id, command.access, 'bd.followup.update');
      assertWritable(company);
      if (followup.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const now = this.clock.now();
      const before = toFollowupView(followup, context(offer, company), now);
      followup.edit(command, now);
      await this.followups.save(followup);
      const after = toFollowupView((await this.followups.findById(followup.id)) ?? followup, context(offer, company), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Followup', entityId: followup.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

export type FollowupClosing = 'complete' | 'cancel';

export interface CloseFollowupCommand {
  id: string;
  version: number;
  /** Résultat (terminer) ou motif (annuler) : obligatoire. */
  text?: string;
  closing: FollowupClosing;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Terminer une relance (avec son résultat) ou l'annuler (avec son motif) : portée, version lue, entreprise non archivée ;
 * terminer exige le droit « terminer », annuler le droit de modifier ; audit avant/après.
 */
@Injectable()
export class CloseFollowupUseCase {
  constructor(
    @Inject(FOLLOWUP_REPOSITORY) private readonly followups: FollowupRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CloseFollowupCommand): Promise<FollowupView> {
    return this.unitOfWork.run(async () => {
      const permission = command.closing === 'complete' ? 'bd.followup.complete' : 'bd.followup.update';
      const { followup, offer, company } = await followupInScope(this.followups, this.offers, this.companies, command.id, command.access, permission);
      assertWritable(company);
      if (followup.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const now = this.clock.now();
      const before = toFollowupView(followup, context(offer, company), now);
      if (command.closing === 'complete') followup.complete(command.text, now);
      else followup.cancel(command.text, now);
      await this.followups.save(followup);
      const after = toFollowupView((await this.followups.findById(followup.id)) ?? followup, context(offer, company), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Followup', entityId: followup.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Lecture d'une relance : hors de la portée de son entreprise, elle est « introuvable ». */
@Injectable()
export class GetFollowupHandler {
  constructor(
    @Inject(FOLLOWUP_REPOSITORY) private readonly followups: FollowupRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<FollowupView> {
    const { followup, offer, company } = await followupInScope(this.followups, this.offers, this.companies, query.id, query.access, 'bd.followup.read');
    return toFollowupView(followup, context(offer, company), this.clock.now());
  }
}

const MAX_PAGE_SIZE = 100;
const DUES: readonly string[] = ['overdue', 'today', 'upcoming'];

/**
 * Liste paginée des relances visibles (la liste « À faire »), triée par échéance. Filtrer par offre exige que cette offre soit dans
 * la portée (sinon « introuvable »). Un filtre d'échéance ne concerne que les relances à faire.
 */
@Injectable()
export class ListFollowupsHandler {
  constructor(
    @Inject(FOLLOWUP_REPOSITORY) private readonly followups: FollowupRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { page: number; pageSize: number; offerId?: string; companyId?: string; status?: string; due?: string; visibility: Visibility; access: AccessContext }): Promise<Page<FollowupView>> {
    if (query.offerId) await offerInScope(this.offers, this.companies, query.offerId, query.access, 'bd.followup.read');
    // Une entreprise hors de la portée de l'appelant est « introuvable », comme pour une offre.
    if (query.companyId) await companyInScope(this.companies, query.companyId, query.access, 'bd.followup.read');
    const now = this.clock.now();
    const status = query.status && Object.values(FollowupStatus).includes(query.status as FollowupStatus) ? (query.status as FollowupStatus) : undefined;
    const due = query.due && DUES.includes(query.due) ? (query.due as FollowupDue) : undefined;
    const result = await this.followups.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      status,
      due,
      today: now.toISOString().slice(0, 10),
      offerId: query.offerId,
      companyId: query.companyId,
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toFollowupView(i.followup, { offerReference: i.offerReference, companyId: i.companyId, companyName: i.companyName }, now)) };
  }
}
