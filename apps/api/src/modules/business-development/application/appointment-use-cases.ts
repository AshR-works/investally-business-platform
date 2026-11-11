import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Appointment, AppointmentStatus, AppointmentType } from '../domain/appointment';
import { APPOINTMENT_REPOSITORY, AppointmentListItem, AppointmentRepository } from '../domain/appointment-repository';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Contact } from '../domain/contact';
import { CONTACT_REPOSITORY, ContactRepository } from '../domain/contact-repository';
import { OFFER_REPOSITORY, OfferRepository } from '../domain/offer-repository';
import { OpportunityStatus } from '../domain/opportunity';
import { OPPORTUNITY_REPOSITORY, OpportunityRepository } from '../domain/opportunity-repository';
import { AppointmentView, toAppointmentView, toConflict } from './appointment-view';
import { companyInScope } from './offer-use-cases';

const NOT_FOUND = 'Rendez-vous introuvable';
const STALE = 'Le rendez-vous a été modifié par un autre utilisateur : rechargez-le avant de le modifier';

/** Une visite chez Investally relève du droit « visite » ; les rendez-vous avec le DAF ou le décideur, du droit « rendez-vous ». */
const resourceOf = (type: AppointmentType): 'visit' | 'appointment' => (type === AppointmentType.Visit ? 'visit' : 'appointment');
const permissionFor = (type: AppointmentType, action: 'read' | 'create' | 'update' | 'cancel'): string => {
  const resource = resourceOf(type);
  // Le catalogue ne prévoit pas d'annulation propre aux visites : elle relève de leur modification.
  return `bd.${resource}.${resource === 'visit' && action === 'cancel' ? 'update' : action}`;
};

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses rendez-vous ne sont plus modifiables");
}

/** Un contact lié à un rendez-vous appartient à l'entreprise du rendez-vous (sinon refus). */
async function contactOf(contacts: ContactRepository, contactId: string | null | undefined, companyId: string): Promise<Contact | null> {
  if (!contactId) return null;
  const contact = await contacts.findById(contactId);
  if (!contact || contact.companyId !== companyId) throw new DomainError('VALIDATION', "Le contact n'appartient pas à cette entreprise");
  return contact;
}

const contactName = (contact: Contact | null): string | null => (contact ? `${contact.firstName} ${contact.lastName}` : null);

interface Loaded {
  appointment: Appointment;
  company: Company;
  contact: Contact | null;
  offerReference: string | null;
  opportunityTitle: string | null;
}

/** Charge le rendez-vous et vérifie qu'il est dans la portée de son entreprise avec le droit demandé ; sinon « introuvable ». */
async function appointmentInScope(
  repos: { appointments: AppointmentRepository; companies: CompanyRepository; contacts: ContactRepository; offers: OfferRepository; opportunities: OpportunityRepository },
  id: string, access: AccessContext, action: 'read' | 'update' | 'cancel',
): Promise<Loaded> {
  const appointment = await repos.appointments.findById(id);
  const company = appointment ? await repos.companies.findById(appointment.companyId) : null;
  if (!appointment || !company || !decideFor(access, permissionFor(appointment.type, action), company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  const contact = appointment.contactId ? await repos.contacts.findById(appointment.contactId) : null;
  const offer = appointment.offerId ? await repos.offers.findById(appointment.offerId) : null;
  const opportunity = appointment.opportunityId ? await repos.opportunities.findById(appointment.opportunityId) : null;
  return { appointment, company, contact, offerReference: offer?.reference ?? null, opportunityTitle: opportunity?.title ?? null };
}

const contextOf = (loaded: Loaded) => ({ companyName: loaded.company.name.value, contactName: contactName(loaded.contact), offerReference: loaded.offerReference, opportunityTitle: loaded.opportunityTitle });

/** Avertit des rendez-vous à venir du même organisateur qui chevauchent le créneau ; ne bloque jamais (règle proposée, D35). */
async function withConflicts(appointments: AppointmentRepository, appointment: Appointment, view: AppointmentView): Promise<AppointmentView> {
  const conflicts = await appointments.findConflicts({ organizerUserId: appointment.organizerUserId, startsAt: appointment.startsAt, endsAt: appointment.endsAt, excludeId: appointment.id });
  return conflicts.length > 0 ? { ...view, conflicts: conflicts.map(toConflict) } : view;
}

export interface PlanAppointmentCommand {
  type: string;
  companyId: string;
  contactId?: string | null;
  offerId?: string | null;
  opportunityId?: string | null;
  startsAt: string;
  durationMinutes?: number;
  location?: string | null;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Planifier un rendez-vous ou une visite : portée de l'entreprise, entreprise non archivée, contact et offre rattachés à cette
 * entreprise ; l'heure ne peut pas être dans le passé ; un conflit d'horaire avertit sans bloquer ; audit.
 */
@Injectable()
export class PlanAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: PlanAppointmentCommand): Promise<AppointmentView> {
    return this.unitOfWork.run(async () => {
      const type = Object.values(AppointmentType).includes(command.type as AppointmentType) ? (command.type as AppointmentType) : null;
      if (!type) throw new DomainError('VALIDATION', 'Le type de rendez-vous est inconnu');
      const company = await companyInScope(this.companies, command.companyId, command.access, permissionFor(type, 'create'));
      assertWritable(company);
      const contact = await contactOf(this.contacts, command.contactId, company.id);
      const offer = command.offerId ? await this.offers.findById(command.offerId) : null;
      if (command.offerId && (!offer || offer.companyId !== company.id)) throw new DomainError('VALIDATION', "L'offre n'appartient pas à cette entreprise");
      const opportunity = command.opportunityId ? await this.opportunities.findById(command.opportunityId) : null;
      if (command.opportunityId && (!opportunity || opportunity.companyId !== company.id)) throw new DomainError('VALIDATION', "L'opportunité n'appartient pas à cette entreprise");
      if (opportunity && opportunity.status !== OpportunityStatus.Open) throw new DomainError('VALIDATION', "L'opportunité est clôturée : on ne planifie plus de rendez-vous pour elle");
      const now = this.clock.now();
      const appointment = Appointment.plan({
        id: this.ids.next(), type, companyId: company.id, contactId: contact?.id ?? null, offerId: offer?.id ?? null, opportunityId: opportunity?.id ?? null, organizerUserId: command.access.actorId,
        startsAt: command.startsAt, durationMinutes: command.durationMinutes, location: command.location, note: command.note, now,
      });
      await this.appointments.save(appointment);
      const view = toAppointmentView(appointment, { companyName: company.name.value, contactName: contactName(contact), offerReference: offer?.reference ?? null, opportunityTitle: opportunity?.title ?? null }, now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Appointment', entityId: appointment.id, action: AuditAction.Create, newValue: { ...view } });
      return withConflicts(this.appointments, appointment, view);
    });
  }
}

export interface UpdateAppointmentCommand {
  id: string;
  version: number;
  contactId?: string | null;
  durationMinutes?: number;
  location?: string | null;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier un rendez-vous À VENIR (contact, durée, lieu, note) : portée, version lue, entreprise non archivée ; audit avant/après. */
@Injectable()
export class UpdateAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: UpdateAppointmentCommand): Promise<AppointmentView> {
    return this.unitOfWork.run(async () => {
      const loaded = await appointmentInScope({ appointments: this.appointments, companies: this.companies, contacts: this.contacts, offers: this.offers, opportunities: this.opportunities }, command.id, command.access, 'update');
      assertWritable(loaded.company);
      if (loaded.appointment.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const now = this.clock.now();
      const before = toAppointmentView(loaded.appointment, contextOf(loaded), now);
      const contact = command.contactId === undefined ? loaded.contact : await contactOf(this.contacts, command.contactId, loaded.company.id);
      loaded.appointment.edit({ durationMinutes: command.durationMinutes, location: command.location, note: command.note, ...(command.contactId === undefined ? {} : { contactId: contact?.id ?? null }) });
      await this.appointments.save(loaded.appointment);
      const saved = (await this.appointments.findById(loaded.appointment.id)) ?? loaded.appointment;
      const after = toAppointmentView(saved, { ...contextOf(loaded), contactName: contactName(contact) }, now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Appointment', entityId: saved.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return withConflicts(this.appointments, saved, after);
    });
  }
}

export type AppointmentTransition = 'postpone' | 'hold' | 'cancel';

export interface TransitionAppointmentCommand {
  id: string;
  version: number;
  transition: AppointmentTransition;
  /** Report : la nouvelle heure de début. */
  startsAt?: string;
  /** Motif (report, annulation) ou compte rendu (tenu) : obligatoire. */
  text?: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Reporter (nouvelle heure + motif), tenir (compte rendu) ou annuler (motif) un rendez-vous : portée, version lue, entreprise non
 * archivée ; annuler exige le droit d'annuler (visite : de modifier) ; audit avant/après. Un report avertit d'un conflit d'horaire.
 */
@Injectable()
export class TransitionAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: TransitionAppointmentCommand): Promise<AppointmentView> {
    return this.unitOfWork.run(async () => {
      const loaded = await appointmentInScope({ appointments: this.appointments, companies: this.companies, contacts: this.contacts, offers: this.offers, opportunities: this.opportunities }, command.id, command.access, command.transition === 'cancel' ? 'cancel' : 'update');
      assertWritable(loaded.company);
      if (loaded.appointment.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const now = this.clock.now();
      const before = toAppointmentView(loaded.appointment, contextOf(loaded), now);
      if (command.transition === 'postpone') loaded.appointment.postpone(command.startsAt ?? '', command.text, now);
      else if (command.transition === 'hold') loaded.appointment.hold(command.text, now);
      else loaded.appointment.cancel(command.text, now);
      await this.appointments.save(loaded.appointment);
      const saved = (await this.appointments.findById(loaded.appointment.id)) ?? loaded.appointment;
      const after = toAppointmentView(saved, contextOf(loaded), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Appointment', entityId: saved.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return command.transition === 'postpone' ? withConflicts(this.appointments, saved, after) : after;
    });
  }
}

/** Lecture d'un rendez-vous : hors de la portée de son entreprise, il est « introuvable ». */
@Injectable()
export class GetAppointmentHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<AppointmentView> {
    const loaded = await appointmentInScope({ appointments: this.appointments, companies: this.companies, contacts: this.contacts, offers: this.offers, opportunities: this.opportunities }, query.id, query.access, 'read');
    return toAppointmentView(loaded.appointment, contextOf(loaded), this.clock.now());
  }
}

const MAX_PAGE_SIZE = 200;
/** Fenêtre d'agenda la plus large acceptée : neuf semaines, de quoi couvrir un mois affiché en grille. */
export const MAX_AGENDA_DAYS = 63;
const STATUSES: readonly string[] = Object.values(AppointmentStatus);
const TYPES: readonly string[] = Object.values(AppointmentType);

export interface ListAppointmentsQuery {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  type?: string;
  status?: string;
  companyId?: string;
  offerId?: string;
  access: AccessContext;
}

/**
 * L'agenda : rendez-vous visibles dans la fenêtre [from, to[, triés par début. La portée est celle de l'entreprise (chargé de
 * compte : les siens ; Responsable commercial : ceux de son équipe). Filtrer par entreprise ou offre exige qu'elle soit dans la portée.
 * Les visites n'apparaissent que pour qui a le droit de les lire.
 */
@Injectable()
export class ListAppointmentsHandler {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointments: AppointmentRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: ListAppointmentsQuery): Promise<Page<AppointmentView>> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new DomainError('VALIDATION', 'La fenêtre de l\'agenda doit avoir un début et une fin valides');
    if (to.getTime() <= from.getTime()) throw new DomainError('VALIDATION', "La fin de la fenêtre doit suivre son début");
    if ((to.getTime() - from.getTime()) / 86400000 > MAX_AGENDA_DAYS) throw new DomainError('VALIDATION', `La fenêtre de l'agenda ne peut dépasser ${MAX_AGENDA_DAYS} jours`);
    if (query.companyId) await companyInScope(this.companies, query.companyId, query.access, 'bd.appointment.read');
    if (query.offerId) {
      const offer = await this.offers.findById(query.offerId);
      const company = offer ? await this.companies.findById(offer.companyId) : null;
      if (!offer || !company || !decideFor(query.access, 'bd.appointment.read', company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Offre introuvable');
    }
    const visibility = visibilityFor(query.access, 'bd.appointment.read');
    const visitVisibility = visibilityFor(query.access, 'bd.visit.read');
    const canSeeVisits = visitVisibility.unrestricted || visitVisibility.ownerIds.length > 0;
    const wanted = query.type && TYPES.includes(query.type) ? [query.type as AppointmentType] : (Object.values(AppointmentType) as AppointmentType[]);
    const types = wanted.filter((t) => canSeeVisits || t !== AppointmentType.Visit);
    const now = this.clock.now();
    const status = query.status && STATUSES.includes(query.status) ? (query.status as AppointmentStatus) : undefined;
    const result: Page<AppointmentListItem> = await this.appointments.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      from, to, types, status, companyId: query.companyId, offerId: query.offerId,
      ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toAppointmentView(i.appointment, { companyName: i.companyName, contactName: i.contactName, offerReference: i.offerReference, opportunityTitle: i.opportunityTitle }, now)) };
  }
}
