import { AppointmentTransition, PlanAppointmentUseCase, TransitionAppointmentUseCase } from '../../modules/business-development/application/appointment-use-cases';
import { AmbassadorOrigin } from '../../modules/business-development/domain/ambassador';
import { RegisterAmbassadorUseCase, UpdateAmbassadorUseCase } from '../../modules/business-development/application/ambassador-use-cases';
import { CloseApprovalUseCase, ReceiveApprovalUseCase, RegisterApprovalUseCase } from '../../modules/business-development/application/approval-use-cases';
import { ChangeCompanyStatusUseCase, CompanyStatus, ReassignCompanyUseCase } from '../../modules/business-development/application/company-lifecycle-use-cases';
import { RegisterContactUseCase } from '../../modules/business-development/application/contact-use-cases';
import { CloseFollowupUseCase, PlanFollowupUseCase } from '../../modules/business-development/application/followup-use-cases';
import { ChangeOfferStatusUseCase, RegisterOfferUseCase } from '../../modules/business-development/application/offer-use-cases';
import { AdvanceOpportunityUseCase, CloseOpportunityUseCase, CreateOpportunityUseCase, GrantWaiverUseCase } from '../../modules/business-development/application/opportunity-use-cases';
import { RegisterCompanyUseCase } from '../../modules/business-development/application/register-company.use-case';
import { ChangePayoutUseCase } from '../../modules/business-development/application/commission-payout-use-cases';
import { CancelReceiptUseCase, RegisterReceiptUseCase } from '../../modules/business-development/application/receipt-use-cases';
import { UpdateCompanyUseCase } from '../../modules/business-development/application/update-company.use-case';
import { CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase, CreateTrainerUseCase, CreateTrainingUseCase } from '../../modules/training/application/catalogue-use-cases';
import { CancelSessionUseCase, OpenSessionUseCase, PlanSessionUseCase, PostponeSessionUseCase } from '../../modules/training/application/session-use-cases';
import { CancelEnrollmentUseCase, ConfirmEnrollmentUseCase, EnrollLearnerUseCase, ListApprovalOptionsHandler, ReplaceEnrollmentUseCase } from '../../modules/training/application/enrollment-use-cases';
import { RegisterLearnerUseCase } from '../../modules/training/application/learner-use-cases';
import { AuthorizationService } from '../../modules/iam/application/authorization.service';
import type { AccessContext } from '../../modules/iam';
import { PrismaService } from '../../platform/prisma.service';
import { ActorContext, CLOCK } from '../../shared-kernel';
import { blockOf, COMPANIES, FORMATION_CLIENTS, SEED_BLOCKS, SeedBlock, SeedEvent, SeedOp, Who } from './seed-plan';

/** Ce dont le chargeur a besoin de l'application : retrouver un service, sans en dépendre autrement (l'application complète ou un test). */
export interface ProviderSource {
  get<T>(token: unknown, options?: { strict: boolean }): T;
}

export interface SeedOptions {
  /** Utilisateur de chaque rôle du plan. */
  users: Record<Who, string>;
  log?: (message: string) => void;
}

export interface SeedResult {
  executed: number;
  /** Vrai si rien n'a été chargé : tous les blocs étaient déjà là. */
  skipped: boolean;
  /** Blocs chargés par cet appel. */
  loaded: SeedBlock[];
  counts: Record<string, number>;
}

/** Nom de la première entreprise du plan : sa présence indique que le bloc commercial est déjà chargé. */
export const SEED_MARKER = COMPANIES[0]!.name;
/** Nom du programme du catalogue : sa présence indique que le bloc « catalogue » est déjà chargé. */
export const CATALOGUE_MARKER = 'Certificats Marchés financiers';
/** Domaine des e-mails de formateurs de démonstration : sa présence indique que le bloc « formateurs » est déjà chargé. */
/** Domaine des e-mails des apprenants de démonstration (fictif, réservé) : repère le bloc des inscriptions. */
export const LEARNERS_MARKER = '@apprenants.test';
export const TRAINERS_MARKER = '@formateurs.investudy.test';

/**
 * Charge le jeu de données de démonstration en rejouant le plan à travers les VRAIS cas d'usage de l'application : mêmes règles
 * (validation, états, versions, portée, audit) que l'interface. L'horloge est avancée de date en date, ce qui donne à chaque objet sa vraie
 * date de création ; elle est rendue à son état normal à la fin. Idempotent : si le jeu est déjà là, rien n'est fait.
 */
export async function runSeed(app: ProviderSource, allEvents: readonly SeedEvent[], options: SeedOptions): Promise<SeedResult> {
  let events = allEvents;
  const log = options.log ?? (() => undefined);
  const prisma = app.get<PrismaService>(PrismaService, { strict: false });
  // Chaque bloc a son marqueur : seuls les blocs absents sont chargés, sans toucher à ce qui existe (une démo ancienne reçoit les nouveaux blocs).
  const present: Record<SeedBlock, boolean> = {
    crm: (await prisma.db.company.count({ where: { name: SEED_MARKER } })) > 0,
    catalogue: (await prisma.db.program.count({ where: { name: CATALOGUE_MARKER } })) > 0,
    formateurs: (await prisma.db.trainer.count({ where: { emailKey: { endsWith: TRAINERS_MARKER } } })) > 0,
    sessions: (await prisma.db.trainingSession.count({ where: { trainer: { emailKey: { endsWith: TRAINERS_MARKER } } } })) > 0,
    inscriptions: (await prisma.db.company.count({ where: { name: FORMATION_CLIENTS[0]![0] } })) > 0,
  };
  const toLoad = SEED_BLOCKS.filter((block) => !present[block]);
  if (toLoad.length === 0) {
    log('Le jeu de démonstration est déjà chargé (tous les blocs sont présents) : rien à faire.');
    return { executed: 0, skipped: true, loaded: [], counts: {} };
  }
  for (const block of SEED_BLOCKS) log(`  bloc « ${block} » : ${present[block] ? 'déjà présent' : 'à charger'}`);
  events = events.filter((event) => toLoad.includes(blockOf(event.op)));

  const clock = app.get<{ now: () => Date }>(CLOCK, { strict: false });
  const realNow = clock.now.bind(clock);
  const authorization = app.get<AuthorizationService>(AuthorizationService, { strict: false });
  const use = <T,>(type: new (...args: never[]) => T): T => app.get<T>(type, { strict: false });
  const accessOf = new Map<Who, AccessContext>();
  const actorOf = (who: Who): ActorContext => ({ userId: options.users[who], sessionId: null, ipAddress: 'cli', device: 'cli:seed:demo' });
  for (const who of Object.keys(options.users) as Who[]) accessOf.set(who, await authorization.contextFor(options.users[who]));

  const ids = new Map<string, string>();
  const id = (key: string): string => {
    const found = ids.get(key);
    if (!found) throw new Error(`Objet « ${key} » introuvable : le plan est incohérent`);
    return found;
  };
  const versionOf = async (kind: 'company' | 'offer' | 'followup' | 'appointment' | 'opportunity' | 'approval' | 'receipt' | 'ambassador', key: string): Promise<number> => {
    const where = { id: id(key) };
    const row = await (prisma.db[kind] as unknown as { findUniqueOrThrow(args: { where: { id: string }; select: { version: true } }): Promise<{ version: number }> }).findUniqueOrThrow({ where, select: { version: true } });
    return row.version;
  };
  const sessionVersion = async (key: string): Promise<number> => (await prisma.db.trainingSession.findUniqueOrThrow({ where: { id: id(key) }, select: { version: true } })).version;
  const enrollmentVersion = async (key: string): Promise<number> => (await prisma.db.enrollment.findUniqueOrThrow({ where: { id: id(key) }, select: { version: true } })).version;
  // Une session du plan se retrouve par son certificat et sa date de début, qu'elle ait été créée dans ce chargement ou dans un précédent.
  const planSessions = new Map(allEvents.flatMap((e) => (e.op.k === 'session' ? [[e.op.key, e.op] as const] : [])));
  const sessionIdOf = async (key: string): Promise<string> => {
    const known = ids.get(key);
    if (known) return known;
    const op = planSessions.get(key);
    if (!op) throw new Error(`Session « ${key} » inconnue du plan`);
    const exact = await prisma.db.trainingSession.findFirst({ where: { training: { title: op.training }, startDate: new Date(`${op.startDate}T00:00:00.000Z`) }, select: { id: true } });
    if (exact) {
      ids.set(key, exact.id);
      return exact.id;
    }
    // Les sessions d'une démo plus ancienne ont d'autres dates (le plan se cale sur la date du chargement) : on retrouve la session par son rang parmi celles du même
    // certificat, dans l'ordre des dates, comme dans le plan.
    const rank = [...planSessions.values()].filter((s) => s.training === op.training).sort((a, b) => a.startDate.localeCompare(b.startDate)).findIndex((s) => s.startDate === op.startDate);
    const stored = await prisma.db.trainingSession.findMany({ where: { training: { title: op.training } }, select: { id: true }, orderBy: [{ startDate: 'asc' }, { id: 'asc' }] });
    const found = stored[rank];
    if (!found) throw new Error(`Session « ${key} » introuvable dans la base : rechargez le jeu de démonstration`);
    ids.set(key, found.id);
    return found.id;
  };
  /** Inscriptions que le jeu n'a pas pu créer (aucun agrément ne les couvrait) : les actions qui en dépendent sont sautées. */
  const missing = new Set<string>();
  const counts: Record<string, number> = {};

  let executed = 0;
  try {
    for (const event of events) {
      const at = event.at;
      clock.now = () => at;
      const access = accessOf.get(event.who)!;
      const actor = actorOf(event.who);
      const op: SeedOp = event.op;
      try {
        switch (op.k) {
          case 'company': {
            const view = await use(RegisterCompanyUseCase).execute({
              name: op.name, ownerUserId: options.users[event.who], sector: op.sector, country: op.country, email: op.email, phone: op.phone, access, actor,
              facilitation: op.facilitator ? { newFacilitator: { lastName: op.facilitator.lastName, firstName: op.facilitator.firstName, phone: op.facilitator.phone, comment: op.facilitator.comment }, contactMethod: op.facilitator.contactMethod, isCompanyEmployee: op.facilitator.isCompanyEmployee } : undefined,
            });
            ids.set(op.key, view.id);
            if (op.facilitator) {
              const link = await prisma.db.companyFacilitation.findUniqueOrThrow({ where: { companyId: view.id }, select: { facilitatorId: true } });
              ids.set(op.facilitator.key, link.facilitatorId);
            }
            break;
          }
          case 'companyFacilitator':
            await use(UpdateCompanyUseCase).execute({ id: id(op.key), version: await versionOf('company', op.key), facilitation: { facilitatorId: id(op.facilitatorKey), contactMethod: op.contactMethod, isCompanyEmployee: op.isCompanyEmployee }, access, actor });
            break;
          case 'commission':
            await use(UpdateCompanyUseCase).execute({ id: id(op.company), version: await versionOf('company', op.company), facilitation: { commission: { type: op.type, value: op.value, currency: op.type === 'FIXED' ? op.currency : undefined } }, access, actor });
            break;
          case 'companyStatus':
            await use(ChangeCompanyStatusUseCase).execute({ id: id(op.company), version: await versionOf('company', op.company), status: op.status as CompanyStatus, access, actor });
            break;
          case 'contact': {
            const view = await use(RegisterContactUseCase).execute({ companyId: id(op.company), lastName: op.lastName, firstName: op.firstName, role: op.role, email: op.email, phone: op.phone, allowDuplicate: true, access, actor });
            ids.set(op.key, (view as { id: string }).id);
            break;
          }
          case 'offer': {
            const view = await use(RegisterOfferUseCase).execute({ companyId: id(op.company), subject: op.subject, amount: op.amount, currency: op.currency, note: op.note, access, actor });
            ids.set(op.key, view.id);
            break;
          }
          case 'offerAction':
            await use(ChangeOfferStatusUseCase).execute({ id: id(op.offer), version: await versionOf('offer', op.offer), action: op.action, reason: op.reason, access, actor });
            break;
          case 'receipt': {
            const view = await use(RegisterReceiptUseCase).execute({ offerId: id(op.offer), receivedOn: at.toISOString().slice(0, 10), receivedBy: op.receivedBy, access, actor });
            ids.set(`receipt:${op.offer}`, (view as { id: string }).id);
            break;
          }
          case 'receiptCancel':
            await use(CancelReceiptUseCase).execute({ id: id(`receipt:${op.offer}`), version: await versionOf('receipt', `receipt:${op.offer}`), reason: op.reason, access, actor });
            break;
          case 'reassign':
            await use(ReassignCompanyUseCase).execute({ id: id(op.company), version: await versionOf('company', op.company), ownerUserId: options.users[op.to], access, actor });
            break;
          case 'payout': {
            const payout = await prisma.db.commissionPayout.findUniqueOrThrow({ where: { approvalId: id(op.approval) }, select: { id: true, version: true } });
            await use(ChangePayoutUseCase).execute({ id: payout.id, version: payout.version, action: op.action, reason: op.reason, access, actor });
            break;
          }
          case 'ambassadorUpdate':
            await use(UpdateAmbassadorUseCase).execute({ id: id(op.ambassador), version: await versionOf('ambassador', op.ambassador), note: op.note, access, actor });
            break;
          case 'followupPlan': {
            const view = await use(PlanFollowupUseCase).execute({ offerId: id(op.offer), dueOn: op.dueOn, channel: op.channel, note: op.note, access, actor });
            ids.set(op.key, view.id);
            break;
          }
          case 'followupClose':
            await use(CloseFollowupUseCase).execute({ id: id(op.followup), version: await versionOf('followup', op.followup), closing: op.closing, text: op.text, access, actor });
            break;
          case 'appointment': {
            const view = await use(PlanAppointmentUseCase).execute({
              type: op.type, companyId: id(op.company), contactId: op.contact ? id(op.contact) : null, opportunityId: op.opportunity ? id(op.opportunity) : null,
              startsAt: op.startsAt, durationMinutes: op.durationMinutes, location: op.location, note: op.note, access, actor,
            });
            ids.set(op.key, (view as { id: string }).id);
            break;
          }
          case 'appointmentTransition':
            await use(TransitionAppointmentUseCase).execute({ id: id(op.appointment), version: await versionOf('appointment', op.appointment), transition: op.transition as AppointmentTransition, text: op.text, startsAt: op.startsAt, access, actor });
            break;
          case 'opportunity': {
            const view = await use(CreateOpportunityUseCase).execute({ companyId: id(op.company), title: op.title, amount: op.amount, currency: op.currency, source: op.source, access, actor });
            ids.set(op.key, view.id);
            break;
          }
          case 'advance':
            await use(AdvanceOpportunityUseCase).execute({ id: id(op.opportunity), version: await versionOf('opportunity', op.opportunity), access, actor });
            break;
          case 'waiver':
            await use(GrantWaiverUseCase).execute({ id: id(op.opportunity), version: await versionOf('opportunity', op.opportunity), reason: op.reason, access, actor });
            break;
          case 'close':
            await use(CloseOpportunityUseCase).execute({ id: id(op.opportunity), version: await versionOf('opportunity', op.opportunity), outcome: op.outcome, reason: op.reason, note: op.note, access, actor });
            break;
          case 'approval': {
            const view = await use(RegisterApprovalUseCase).execute({
              opportunityId: id(op.opportunity), amount: op.amount, places: op.places, currency: op.currency, requested: op.requested, receivedOn: op.receivedOn,
              validUntil: op.validUntil, payerName: op.payerName, payerType: op.payerType, access, actor,
            });
            ids.set(op.key, view.id);
            break;
          }
          case 'approvalReceive':
            await use(ReceiveApprovalUseCase).execute({ id: id(op.approval), version: await versionOf('approval', op.approval), receivedOn: op.receivedOn, access, actor });
            break;
          case 'approvalClose':
            await use(CloseApprovalUseCase).execute({ id: id(op.approval), version: await versionOf('approval', op.approval), action: op.action, reason: op.reason, access, actor });
            break;
          case 'trainer':
            ids.set(op.key, (await use(CreateTrainerUseCase).execute({ lastName: op.lastName, firstName: op.firstName, specialties: op.specialties, email: op.email, phone: op.phone, actor })).id);
            break;
          case 'program':
            ids.set(op.key, (await use(CreateProgramUseCase).execute({ name: op.name, audience: op.audience, description: op.description, actor })).id);
            break;
          case 'module':
            ids.set(op.key, (await use(CreateModuleUseCase).execute({ title: op.title, requiresWorkstations: op.requiresWorkstations, actor })).id);
            break;
          case 'training':
            ids.set(op.key, (await use(CreateTrainingUseCase).execute({
              programId: id(op.program), title: op.title, objectives: op.objectives, priceAmount: op.priceAmount, modulePriceAmount: op.modulePriceAmount,
              moduleIds: op.modules.map(id), actor,
            })).id);
            break;
          case 'room':
            ids.set(op.key, (await use(CreateRoomUseCase).execute({
              name: op.name, kind: op.kind, learnerSeats: op.learnerSeats, unavailableSeats: op.unavailableSeats, trainerSeats: op.trainerSeats, equipment: op.equipment, actor,
            })).id);
            break;
          case 'session': {
            // Le catalogue et les formateurs se désignent par leur nom : le bloc des sessions se charge seul sur une démo qui les a déjà.
            const [training, room, trainer] = await Promise.all([
              prisma.db.training.findFirstOrThrow({ where: { title: op.training, program: { name: CATALOGUE_MARKER } }, select: { id: true } }),
              prisma.db.room.findFirstOrThrow({ where: { name: op.room }, select: { id: true } }),
              prisma.db.trainer.findFirstOrThrow({ where: { emailKey: op.trainer.toLowerCase() }, select: { id: true } }),
            ]);
            ids.set(op.key, (await use(PlanSessionUseCase).execute({
              trainingId: training.id, rhythm: 'DAY', startDate: op.startDate, roomId: room.id, trainerId: trainer.id, capacity: op.capacity, actor,
            })).id);
            break;
          }
          case 'sessionOpen':
            await use(OpenSessionUseCase).execute({ id: id(op.session), version: await sessionVersion(op.session), actor });
            break;
          case 'sessionPostpone':
            await use(PostponeSessionUseCase).execute({ id: id(op.session), version: await sessionVersion(op.session), startDate: op.startDate, reason: op.reason, actor });
            break;
          case 'sessionCancel':
            await use(CancelSessionUseCase).execute({ id: id(op.session), version: await sessionVersion(op.session), reason: op.reason, actor });
            break;
          case 'learner': {
            ids.set(op.key, (await use(RegisterLearnerUseCase).execute({ companyId: id(op.company), lastName: op.lastName, firstName: op.firstName, email: op.email, phone: op.phone, access, actor })).id);
            break;
          }
          case 'enroll': {
            const sessionId = await sessionIdOf(op.session);
            // Chargé seul sur une démo dont les sessions existent déjà, le bloc trouve la session annulée déjà annulée : ses inscrits d'avant l'annulation ne peuvent plus être créés.
            if ((await prisma.db.trainingSession.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true } })).status === 'CANCELLED') {
              missing.add(op.key);
              log(`  inscription « ${op.key} » non créée : la session est déjà annulée dans cette démo`);
              break;
            }
            const options = await use(ListApprovalOptionsHandler).execute({ learnerId: id(op.learner), sessionId, access });
            const approval = options.find((o) => o.eligible);
            if (!approval) {
              missing.add(op.key);
              log(`  inscription « ${op.key} » non créée : aucun agrément de l'entreprise ne la couvre (${options.map((o) => o.reason ?? o.status).join(' | ') || 'aucun agrément'})`);
              break;
            }
            ids.set(op.key, (await use(EnrollLearnerUseCase).execute({ sessionId, learnerId: id(op.learner), approvalId: approval.id, access, actor })).id);
            break;
          }
          case 'enrollConfirm':
          case 'enrollCancel':
          case 'enrollReplace': {
            if (missing.has(op.enrollment)) break;
            const base = { id: id(op.enrollment), version: await enrollmentVersion(op.enrollment), access, actor };
            if (op.k === 'enrollConfirm') await use(ConfirmEnrollmentUseCase).execute(base);
            else if (op.k === 'enrollCancel') await use(CancelEnrollmentUseCase).execute({ ...base, reason: op.reason });
            else {
              const sessionId = await sessionIdOf(op.session);
              const learnerId = (await prisma.db.enrollment.findUniqueOrThrow({ where: { id: base.id }, select: { learnerId: true } })).learnerId;
              const approval = (await use(ListApprovalOptionsHandler).execute({ learnerId, sessionId, access })).find((o) => o.eligible);
              if (!approval) {
                log(`  replacement de « ${op.enrollment} » non fait : aucun agrément ne couvre la nouvelle session`);
                break;
              }
              await use(ReplaceEnrollmentUseCase).execute({ ...base, sessionId, approvalId: approval.id });
            }
            break;
          }
          case 'ambassador': {
            const view = await use(RegisterAmbassadorUseCase).execute({
              lastName: op.lastName, firstName: op.firstName, origin: op.origin as AmbassadorOrigin, companyId: op.company ? id(op.company) : null, email: op.email, phone: op.phone,
              appointedOn: op.appointedOn, note: op.note, access, actor,
            });
            ids.set(op.key, (view as { id: string }).id);
            break;
          }
        }
      } catch (error) {
        throw new Error(`Événement ${executed + 1}/${events.length} (${op.k}, ${event.who}, ${event.at.toISOString().slice(0, 10)}) : ${error instanceof Error ? error.message : String(error)}`);
      }
      counts[op.k] = (counts[op.k] ?? 0) + 1;
      executed += 1;
      if (executed % 100 === 0) log(`  ${executed} / ${events.length} événements…`);
    }
  } finally {
    clock.now = realNow;
  }
  log(`Jeu de démonstration chargé : ${executed} événements.`);
  return { executed, skipped: false, loaded: [...toLoad], counts };
}
