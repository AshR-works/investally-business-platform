import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import {
  MODULE_REPOSITORY, ModuleRepository, PROGRAM_REPOSITORY, ProgramRepository, ROOM_REPOSITORY, RoomRepository, TRAINER_REPOSITORY, TrainerRepository, TRAINING_REPOSITORY,
  TrainingRepository,
} from '../domain/catalogue-repositories';
import { IsoDate, parseIsoDate, toIsoDate } from '../domain/session-dates';
import { SESSION_REPOSITORY, SessionRepository } from '../domain/session-repositories';
import { SessionStatus, TrainingSession } from '../domain/training-session';
import { assertVersion, normalizePage } from './catalogue-use-cases';
import { SessionContext, SessionView, toSessionView } from './session-view';

const SESSION_NOT_FOUND = 'Session introuvable';

/**
 * Compose la vue d'une session (noms du certificat, de la salle et du formateur) : une lecture de chaque objet lié, mémorisée le temps
 * d'un appel. Une liste de 100 sessions ne lit donc qu'une fois chaque salle, chaque formateur et chaque certificat.
 */
@Injectable()
export class SessionViews {
  constructor(
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async many(sessions: readonly TrainingSession[]): Promise<SessionView[]> {
    const today = toIsoDate(this.clock.now());
    const trainingContext = new Map<string, Promise<Pick<SessionContext, 'trainingTitle' | 'programName' | 'needsWorkstations'>>>();
    const roomContext = new Map<string, Promise<Pick<SessionContext, 'roomName' | 'roomKind' | 'roomUsableSeats'>>>();
    const trainerContext = new Map<string, Promise<string>>();

    const trainingOf = (id: string) => {
      let found = trainingContext.get(id);
      if (!found) {
        found = (async () => {
          const training = await this.trainings.findById(id);
          if (!training) return { trainingTitle: '', programName: '', needsWorkstations: false };
          const [program, modules] = await Promise.all([this.programs.findById(training.programId), this.modules.findByIds(training.moduleIds)]);
          return { trainingTitle: training.title, programName: program?.name ?? '', needsWorkstations: modules.some((m) => m.requiresWorkstations) };
        })();
        trainingContext.set(id, found);
      }
      return found;
    };
    const roomOf = (id: string) => {
      let found = roomContext.get(id);
      if (!found) {
        found = this.rooms.findById(id).then((room) => ({ roomName: room?.name ?? '', roomKind: room?.kind ?? 'WORKSTATIONS' as const, roomUsableSeats: room?.usableSeats ?? 0 }));
        roomContext.set(id, found);
      }
      return found;
    };
    const trainerOf = (id: string) => {
      let found = trainerContext.get(id);
      if (!found) {
        found = this.trainers.findById(id).then((trainer) => (trainer ? `${trainer.firstName} ${trainer.lastName}` : ''));
        trainerContext.set(id, found);
      }
      return found;
    };

    const views: SessionView[] = [];
    for (const session of sessions) {
      const [training, room, trainerName] = await Promise.all([trainingOf(session.trainingId), roomOf(session.roomId), trainerOf(session.trainerId)]);
      views.push(toSessionView(session, { ...training, ...room, trainerName }, today));
    }
    return views;
  }

  async of(session: TrainingSession): Promise<SessionView> {
    return (await this.many([session]))[0];
  }
}

/** Ce qui change dans une écriture : détermine les contrôles à rejouer (une session existante n'est pas recontrôlée sur ce qui n'a pas bougé). */
interface Changes {
  created?: boolean;
  room?: boolean;
  trainer?: boolean;
  capacity?: boolean;
  dates?: boolean;
}

/**
 * Règles qui regardent d'autres objets que la session : certificat, salle et formateur existants et actifs (à la création, ou quand ils
 * changent) ; capacité dans les places utiles de la salle (D-SESS-5 B) ; salle avec postes si un module du certificat en exige (D-SESS-6 B) ;
 * salle et formateur libres pendant toute la session (V4).
 */
@Injectable()
export class SessionRules {
  constructor(
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async check(session: TrainingSession, changes: Changes): Promise<void> {
    const training = await this.trainings.findById(session.trainingId);
    if (!training) throw new DomainError('NOT_FOUND', 'Certificat introuvable');
    if (changes.created && training.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le certificat est archivé : on ne peut pas y planifier de session');

    const room = await this.rooms.findById(session.roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'Salle introuvable');
    if ((changes.created || changes.room) && room.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'La salle est désactivée : choisissez une salle active');

    const trainer = await this.trainers.findById(session.trainerId);
    if (!trainer) throw new DomainError('NOT_FOUND', 'Formateur introuvable');
    if ((changes.created || changes.trainer) && trainer.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le formateur est désactivé : choisissez un formateur actif');

    if ((changes.created || changes.capacity || changes.room) && session.capacity > room.usableSeats) {
      throw new DomainError('INVARIANT_VIOLATION', `La capacité (${session.capacity}) dépasse les places utiles de la salle « ${room.name} » (${room.usableSeats})`);
    }
    if (changes.created || changes.room) {
      const modules = await this.modules.findByIds(training.moduleIds);
      if (modules.some((m) => m.requiresWorkstations) && room.kind !== 'WORKSTATIONS') {
        throw new DomainError('INVARIANT_VIOLATION', `Ce certificat contient un module pratique sur poste de travail : la salle « ${room.name} » n'a pas de postes de travail`);
      }
    }
    if (changes.created || changes.room || changes.trainer || changes.dates) {
      await this.sessions.lockResources(session.roomId, session.trainerId);
      const conflicts = await this.sessions.findConflicts({
        roomId: session.roomId, trainerId: session.trainerId, start: session.startDate, end: session.endDate, excludeId: session.id,
      });
      const first = conflicts[0];
      if (first) {
        const sameRoom = first.roomId === session.roomId;
        const other = await this.trainings.findById(first.trainingId);
        throw new DomainError(
          'CONFLICT',
          `${sameRoom ? `La salle « ${room.name} » est déjà prise` : `Le formateur ${trainer.firstName} ${trainer.lastName} est déjà pris`} du ${first.startDate} au ${first.endDate} par la session « ${other?.title ?? 'autre session'} »`,
        );
      }
    }
  }
}

const today = (clock: Clock): IsoDate => toIsoDate(clock.now());

// ───────────────────────────── Écritures ─────────────────────────────

export interface PlanSessionCommand { trainingId: string; rhythm: string; startDate: string; roomId: string; trainerId: string; capacity: number; actor: ActorContext }
export interface UpdateSessionCommand { id: string; version: number; roomId?: string; trainerId?: string; capacity?: number; actor: ActorContext }
export interface OpenSessionCommand { id: string; version: number; actor: ActorContext }
export interface PostponeSessionCommand { id: string; version: number; startDate: string; reason: string; actor: ActorContext }
export interface CancelSessionCommand { id: string; version: number; reason: string; actor: ActorContext }

@Injectable()
export class PlanSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly rules: SessionRules,
    private readonly views: SessionViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: PlanSessionCommand): Promise<SessionView> {
    return this.unitOfWork.run(async () => {
      const session = TrainingSession.create({ ...command, id: this.ids.next(), today: today(this.clock), now: this.clock.now() });
      await this.rules.check(session, { created: true });
      await this.sessions.save(session);
      const view = await this.views.of(session);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'TrainingSession', entityId: session.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Charge la session, contrôle la version lue ; l'écriture se fait ensuite sous verrou optimiste. */
async function loadForWrite(sessions: SessionRepository, id: string, version: number): Promise<TrainingSession> {
  const session = await sessions.findById(id);
  if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
  assertVersion(session.version, version, 'La session');
  return session;
}

@Injectable()
export class UpdateSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly rules: SessionRules,
    private readonly views: SessionViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: UpdateSessionCommand): Promise<SessionView> {
    return this.unitOfWork.run(async () => {
      const session = await loadForWrite(this.sessions, command.id, command.version);
      const before = await this.views.of(session);
      const room = command.roomId !== undefined && command.roomId !== session.roomId;
      const trainer = command.trainerId !== undefined && command.trainerId !== session.trainerId;
      const capacity = command.capacity !== undefined && command.capacity !== session.capacity;
      session.update({ roomId: command.roomId, trainerId: command.trainerId, capacity: command.capacity }, today(this.clock));
      await this.rules.check(session, { room, trainer, capacity });
      await this.sessions.save(session);
      const after = await this.views.of((await this.sessions.findById(session.id)) ?? session);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'TrainingSession', entityId: session.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class OpenSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly views: SessionViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: OpenSessionCommand): Promise<SessionView> {
    return this.unitOfWork.run(async () => {
      const session = await loadForWrite(this.sessions, command.id, command.version);
      const before = await this.views.of(session);
      session.open();
      await this.sessions.save(session);
      const after = await this.views.of((await this.sessions.findById(session.id)) ?? session);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'TrainingSession', entityId: session.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class PostponeSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly rules: SessionRules,
    private readonly views: SessionViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: PostponeSessionCommand): Promise<SessionView> {
    return this.unitOfWork.run(async () => {
      const session = await loadForWrite(this.sessions, command.id, command.version);
      const before = await this.views.of(session);
      session.postpone(command.startDate, command.reason, today(this.clock));
      await this.rules.check(session, { dates: true });
      await this.sessions.save(session);
      const after = await this.views.of((await this.sessions.findById(session.id)) ?? session);
      await this.audit.record({
        actor: command.actor, module: 'training', entityType: 'TrainingSession', entityId: session.id, action: AuditAction.Update,
        oldValue: { ...before }, newValue: { ...after, postponeReason: command.reason.trim() },
      });
      return after;
    });
  }
}

@Injectable()
export class CancelSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    private readonly views: SessionViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: CancelSessionCommand): Promise<SessionView> {
    return this.unitOfWork.run(async () => {
      const session = await loadForWrite(this.sessions, command.id, command.version);
      const before = await this.views.of(session);
      session.cancel(command.reason);
      await this.sessions.save(session);
      const after = await this.views.of((await this.sessions.findById(session.id)) ?? session);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'TrainingSession', entityId: session.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

// ───────────────────────────── Lectures ─────────────────────────────

/**
 * Qui voit une session : tout détenteur de `training.session.read` en portée « Tous » ; le formateur (portée « Propre ») ne voit que
 * les sessions dont le formateur est lié à son compte. Hors portée = « introuvable », jamais « interdit ».
 */
@Injectable()
export class GetSessionHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    private readonly views: SessionViews,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<SessionView> {
    const session = await this.sessions.findById(query.id);
    if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
    const visibility = visibilityFor(query.access, 'training.session.read');
    if (!visibility.unrestricted) {
      const trainer = await this.trainers.findById(session.trainerId);
      if (!trainer?.userId || !visibility.ownerIds.includes(trainer.userId)) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
    }
    return this.views.of(session);
  }
}

export interface ListSessionsQuery {
  page: number;
  pageSize: number;
  status?: SessionStatus;
  roomId?: string;
  trainerId?: string;
  trainingId?: string;
  from?: string;
  to?: string;
  access: AccessContext;
}

@Injectable()
export class ListSessionsHandler {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository, private readonly views: SessionViews) {}

  async execute(query: ListSessionsQuery): Promise<Page<SessionView>> {
    const visibility = visibilityFor(query.access, 'training.session.read');
    const from = query.from ? parseIsoDate(query.from, 'La date de début de période') : undefined;
    const to = query.to ? parseIsoDate(query.to, 'La date de fin de période') : undefined;
    if (from && to && from > to) throw new DomainError('VALIDATION', 'La période est à l\'envers : la fin précède le début');
    const result = await this.sessions.list({
      status: query.status, roomId: query.roomId, trainerId: query.trainerId, trainingId: query.trainingId, from, to,
      ...normalizePage(query),
      visibleToUserIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    return { ...result, items: await this.views.many(result.items) };
  }
}
