import { InMemoryModules, InMemoryPrograms, InMemoryRooms, InMemoryTrainers, InMemoryTrainings } from '../../../../test/support/in-memory-catalogue';
import { InMemorySessions } from '../../../../test/support/in-memory-sessions';
import { ActorContext, DomainError } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam/domain/roles';
import { CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase, CreateTrainerUseCase, CreateTrainingUseCase, TrainingViews, UpdateRoomUseCase, ChangeRoomStatusUseCase, ChangeTrainerStatusUseCase, ChangeTrainingStatusUseCase, UpdateTrainerUseCase } from './catalogue-use-cases';
import {
  CancelSessionUseCase, GetSessionHandler, ListSessionsHandler, OpenSessionUseCase, PlanSessionUseCase, PostponeSessionUseCase, SessionRules, SessionViews, UpdateSessionUseCase,
} from './session-use-cases';

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
let currentNow = new Date('2026-11-06T09:00:00Z'); // vendredi

const as = (role: RoleCode, actorId: string): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: [] });

async function build() {
  const programs = new InMemoryPrograms();
  const trainings = new InMemoryTrainings(programs);
  programs.trainings = trainings;
  const modules = new InMemoryModules();
  const rooms = new InMemoryRooms();
  const trainers = new InMemoryTrainers();
  const sessions = new InMemorySessions(trainers);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => currentNow };
  const ids = { next: () => `id-${++seq}` };
  const trainingViews = new TrainingViews(programs, modules);
  const views = new SessionViews(trainings, programs, modules, rooms, trainers, clock);
  const rules = new SessionRules(trainings, modules, rooms, trainers, sessions);

  const createProgram = new CreateProgramUseCase(programs, recorder, unitOfWork, clock, ids);
  const createModule = new CreateModuleUseCase(modules, recorder, unitOfWork, clock, ids);
  const createTraining = new CreateTrainingUseCase(trainings, programs, modules, trainingViews, recorder, unitOfWork, clock, ids);
  const createRoom = new CreateRoomUseCase(rooms, recorder, unitOfWork, clock, ids);
  const createTrainer = new CreateTrainerUseCase(trainers, recorder, unitOfWork, clock, ids);

  const program = await createProgram.execute({ name: 'Marchés financiers', actor });
  const magistral = await createModule.execute({ title: 'Introduction aux marchés', requiresWorkstations: false, actor });
  const pratique = await createModule.execute({ title: 'Trading sur poste', requiresWorkstations: true, actor });
  const certTheory = await createTraining.execute({ programId: program.id, title: 'Certificat théorique', moduleIds: [magistral.id], actor });
  const certTrading = await createTraining.execute({ programId: program.id, title: 'Certificat trading', moduleIds: [magistral.id, pratique.id], actor });
  const salleMarches = await createRoom.execute({ name: 'Salle de marchés', kind: 'WORKSTATIONS', learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, actor });
  const salleCours = await createRoom.execute({ name: 'Salle de réunion', kind: 'CLASSROOM', learnerSeats: 16, trainerSeats: 0, actor });
  const interne = await createTrainer.execute({ lastName: 'Interne', firstName: 'Ida', userId: 'user-ida', actor });
  const externe = await createTrainer.execute({ lastName: 'Externe', firstName: 'Eli', email: 'eli@formateurs.test', actor });

  return {
    audit, sessions, certTheory, certTrading, salleMarches, salleCours, interne, externe, rooms, trainers, trainings,
    plan: new PlanSessionUseCase(sessions, rules, views, recorder, unitOfWork, clock, ids),
    update: new UpdateSessionUseCase(sessions, rules, views, recorder, unitOfWork, clock),
    open: new OpenSessionUseCase(sessions, views, recorder, unitOfWork),
    postpone: new PostponeSessionUseCase(sessions, rules, views, recorder, unitOfWork, clock),
    cancel: new CancelSessionUseCase(sessions, views, recorder, unitOfWork),
    get: new GetSessionHandler(sessions, trainers, views),
    list: new ListSessionsHandler(sessions, views),
    updateRoom: new UpdateRoomUseCase(rooms, recorder, unitOfWork),
    statusRoom: new ChangeRoomStatusUseCase(rooms, recorder, unitOfWork),
    statusTrainer: new ChangeTrainerStatusUseCase(trainers, recorder, unitOfWork),
    statusTraining: new ChangeTrainingStatusUseCase(trainings, programs, trainingViews, recorder, unitOfWork),
    updateTrainer: new UpdateTrainerUseCase(trainers, recorder, unitOfWork),
  };
}
type World = Awaited<ReturnType<typeof build>>;

const rejects = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  if (message) expect((error as DomainError).message).toMatch(message);
};

const base = (w: World, over: Record<string, unknown> = {}) => ({
  trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 13, actor, ...over,
});

beforeEach(() => { currentNow = new Date('2026-11-06T09:00:00Z'); });

describe('Sessions — planifier', () => {
  it('planifie une session : fin déduite du rythme, vue complète, audit', async () => {
    const w = await build();
    const view = await w.plan.execute(base(w));
    expect(view).toMatchObject({
      status: 'PLANNED', phase: 'UPCOMING', startDate: '2026-11-16', endDate: '2026-11-20', capacity: 13, version: 1, trainingTitle: 'Certificat trading', programName: 'Marchés financiers',
      roomName: 'Salle de marchés', roomKind: 'WORKSTATIONS', roomUsableSeats: 13, trainerName: 'Ida Interne', needsWorkstations: true,
      rhythm: { code: 'DAY', weeks: 1, totalHours: 35 },
    });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'TrainingSession', module: 'training' });
    expect(w.sessions.locks).toBe(1);
  });

  it('refuse la capacité au-delà des places utiles de la salle (13, pas 14), accepte exactement les places utiles', async () => {
    const w = await build();
    await rejects(w.plan.execute(base(w, { capacity: 14 })), 'INVARIANT_VIOLATION', /dépasse les places utiles.*13/);
    await expect(w.plan.execute(base(w, { capacity: 13 }))).resolves.toMatchObject({ capacity: 13 });
  });

  it('exige une salle avec postes pour un certificat à module pratique, pas pour un certificat théorique', async () => {
    const w = await build();
    await rejects(w.plan.execute(base(w, { roomId: w.salleCours.id, capacity: 10 })), 'INVARIANT_VIOLATION', /module pratique/);
    await expect(w.plan.execute(base(w, { trainingId: w.certTheory.id, roomId: w.salleCours.id, capacity: 16 }))).resolves.toMatchObject({ roomKind: 'CLASSROOM', needsWorkstations: false });
  });

  it('refuse le rythme du soir (en préparation), une date passée, un week-end', async () => {
    const w = await build();
    await rejects(w.plan.execute(base(w, { rhythm: 'EVENING' })), 'INVARIANT_VIOLATION', /pas encore ouvert/);
    await rejects(w.plan.execute(base(w, { startDate: '2026-11-02' })), 'VALIDATION', /passé/);
    await rejects(w.plan.execute(base(w, { startDate: '2026-11-21' })), 'VALIDATION', /jour de cours/);
    expect(w.sessions.items).toHaveLength(0);
  });

  it('refuse un certificat, une salle ou un formateur introuvable ou désactivé', async () => {
    const w = await build();
    await rejects(w.plan.execute(base(w, { trainingId: 'inconnu' })), 'NOT_FOUND', /Certificat/);
    await rejects(w.plan.execute(base(w, { roomId: 'inconnue' })), 'NOT_FOUND', /Salle/);
    await rejects(w.plan.execute(base(w, { trainerId: 'inconnu' })), 'NOT_FOUND', /Formateur/);
    const room = await w.rooms.findById(w.salleCours.id);
    room!.archive();
    await rejects(w.plan.execute(base(w, { trainingId: w.certTheory.id, roomId: w.salleCours.id, capacity: 5 })), 'INVARIANT_VIOLATION', /salle est désactivée/);
    const trainer = await w.trainers.findById(w.externe.id);
    trainer!.archive();
    await rejects(w.plan.execute(base(w, { trainerId: w.externe.id })), 'INVARIANT_VIOLATION', /formateur est désactivé/);
    const training = await w.trainings.findById(w.certTheory.id);
    training!.archive();
    await rejects(w.plan.execute(base(w, { trainingId: w.certTheory.id })), 'INVARIANT_VIOLATION', /certificat est archivé/);
  });
});

describe('Sessions — chevauchements', () => {
  it('refuse une salle déjà prise sur la période (même partiellement), avec la session en conflit', async () => {
    const w = await build();
    await w.plan.execute(base(w));
    await rejects(w.plan.execute(base(w, { startDate: '2026-11-20', trainerId: w.externe.id })), 'CONFLICT', /La salle « Salle de marchés » est déjà prise du 2026-11-16 au 2026-11-20 par la session « Certificat trading »/);
  });

  it('refuse un formateur déjà pris, même dans une autre salle', async () => {
    const w = await build();
    await w.plan.execute(base(w));
    await rejects(
      w.plan.execute(base(w, { trainingId: w.certTheory.id, roomId: w.salleCours.id, capacity: 10 })),
      'CONFLICT', /Le formateur Ida Interne est déjà pris/,
    );
  });

  it('accepte la semaine suivante, un autre formateur dans une autre salle, et une salle libérée par une annulation', async () => {
    const w = await build();
    const first = await w.plan.execute(base(w));
    await expect(w.plan.execute(base(w, { startDate: '2026-11-23' }))).resolves.toMatchObject({ startDate: '2026-11-23' });
    await expect(w.plan.execute(base(w, { trainingId: w.certTheory.id, roomId: w.salleCours.id, trainerId: w.externe.id, capacity: 10 }))).resolves.toBeDefined();
    await w.cancel.execute({ id: first.id, version: 1, reason: 'Annulée', actor });
    await expect(w.plan.execute(base(w, { capacity: 5 }))).resolves.toMatchObject({ startDate: '2026-11-16', roomName: 'Salle de marchés', trainerName: 'Ida Interne' });
  });
});

describe('Sessions — modifier, ouvrir, reporter, annuler', () => {
  it('modifie la capacité et le formateur avant le début ; trace l\'ancienne et la nouvelle valeur ; version périmée = conflit', async () => {
    const w = await build();
    const view = await w.plan.execute(base(w));
    const updated = await w.update.execute({ id: view.id, version: 1, capacity: 10, trainerId: w.externe.id, actor });
    expect(updated).toMatchObject({ capacity: 10, trainerName: 'Eli Externe' });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, oldValue: { capacity: 13 }, newValue: { capacity: 10 } });
    await rejects(w.update.execute({ id: view.id, version: 5, capacity: 9, actor }), 'CONFLICT', /modifié par un autre utilisateur/);
    await rejects(w.update.execute({ id: 'inconnue', version: 1, capacity: 9, actor }), 'NOT_FOUND', /Session introuvable/);
  });

  it('applique le plafond de la salle aussi à la modification, et le contrôle de chevauchement quand le formateur change', async () => {
    const w = await build();
    const a = await w.plan.execute(base(w));
    await w.plan.execute(base(w, { trainingId: w.certTheory.id, roomId: w.salleCours.id, trainerId: w.externe.id, capacity: 10 }));
    await rejects(w.update.execute({ id: a.id, version: 1, capacity: 14, actor }), 'INVARIANT_VIOLATION', /dépasse les places utiles/);
    await rejects(w.update.execute({ id: a.id, version: 1, trainerId: w.externe.id, actor }), 'CONFLICT', /Le formateur Eli Externe est déjà pris/);
    await rejects(w.update.execute({ id: a.id, version: 1, roomId: w.salleCours.id, capacity: 10, trainerId: w.interne.id, actor }), 'INVARIANT_VIOLATION', /module pratique/);
  });

  it('ne change plus de salle ni de formateur une fois la session commencée ; la capacité reste modifiable', async () => {
    const w = await build();
    const view = await w.plan.execute(base(w));
    currentNow = new Date('2026-11-17T09:00:00Z');
    await rejects(w.update.execute({ id: view.id, version: 1, trainerId: w.externe.id, actor }), 'INVARIANT_VIOLATION', /a commencé/);
    await expect(w.update.execute({ id: view.id, version: 1, capacity: 12, actor })).resolves.toMatchObject({ capacity: 12, phase: 'IN_PROGRESS' });
  });

  it('ouvre la session aux inscriptions une seule fois', async () => {
    const w = await build();
    const view = await w.plan.execute(base(w));
    await expect(w.open.execute({ id: view.id, version: 1, actor })).resolves.toMatchObject({ status: 'OPEN' });
    await rejects(w.open.execute({ id: view.id, version: 1, actor }), 'INVARIANT_VIOLATION', /déjà ouverte/);
  });

  it('reporte à une autre date : fin recalculée, motif tracé, chevauchement contrôlé à la nouvelle date', async () => {
    const w = await build();
    const a = await w.plan.execute(base(w));
    await w.plan.execute(base(w, { startDate: '2026-11-30' }));
    const postponed = await w.postpone.execute({ id: a.id, version: 1, startDate: '2026-11-23', reason: 'Formateur indisponible', actor });
    expect(postponed).toMatchObject({ startDate: '2026-11-23', endDate: '2026-11-27', status: 'PLANNED' });
    expect(w.audit.at(-1)).toMatchObject({ oldValue: { startDate: '2026-11-16' }, newValue: { startDate: '2026-11-23', postponeReason: 'Formateur indisponible' } });
    await rejects(w.postpone.execute({ id: a.id, version: 1, startDate: '2026-11-30', reason: 'Plus tard', actor }), 'CONFLICT', /est déjà prise du 2026-11-30/);
    await rejects(w.postpone.execute({ id: a.id, version: 1, startDate: '2026-12-07', reason: '  ', actor }), 'VALIDATION', /motif/);
  });

  it('annule avec un motif, libère la période, et n\'accepte plus aucune modification', async () => {
    const w = await build();
    const view = await w.plan.execute(base(w));
    await rejects(w.cancel.execute({ id: view.id, version: 1, reason: '', actor }), 'VALIDATION', /motif/);
    const cancelled = await w.cancel.execute({ id: view.id, version: 1, reason: 'Pas assez d\'inscrits', actor });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Pas assez d\'inscrits' });
    await rejects(w.cancel.execute({ id: view.id, version: 1, reason: 'Encore', actor }), 'INVARIANT_VIOLATION', /déjà annulée/);
    await rejects(w.update.execute({ id: view.id, version: 1, capacity: 5, actor }), 'INVARIANT_VIOLATION', /annulée/);
    await rejects(w.open.execute({ id: view.id, version: 1, actor }), 'INVARIANT_VIOLATION', /planifiée/);
  });
});

describe('Sessions — lecture et portée', () => {
  it('liste et filtre : état, salle, formateur, période ; période à l\'envers refusée', async () => {
    const w = await build();
    const a = await w.plan.execute(base(w));
    await w.plan.execute(base(w, { startDate: '2026-11-30', trainerId: w.externe.id }));
    await w.cancel.execute({ id: a.id, version: 1, reason: 'Annulée', actor });
    const head = as(RoleCode.TrainingManager, 'chef');
    const q = { page: 1, pageSize: 20, access: head };
    expect((await w.list.execute(q)).total).toBe(2);
    expect((await w.list.execute({ ...q, status: 'CANCELLED' })).items.map((s) => s.id)).toEqual([a.id]);
    expect((await w.list.execute({ ...q, trainerId: w.externe.id })).total).toBe(1);
    expect((await w.list.execute({ ...q, from: '2026-11-25', to: '2026-12-04' })).total).toBe(1);
    expect((await w.list.execute({ ...q, from: '2026-11-21', to: '2026-11-29' })).total).toBe(0);
    await rejects(w.list.execute({ ...q, from: '2026-12-01', to: '2026-11-01' }), 'VALIDATION', /à l'envers/);
    await rejects(w.list.execute({ ...q, from: 'demain' }), 'VALIDATION', /AAAA-MM-JJ/);
  });

  it('le formateur (portée Propre) ne voit que ses sessions ; une session d\'un autre est « introuvable », comme une session inexistante', async () => {
    const w = await build();
    const mine = await w.plan.execute(base(w));
    const other = await w.plan.execute(base(w, { startDate: '2026-11-23', trainerId: w.externe.id }));
    const ida = as(RoleCode.Trainer, 'user-ida');
    const list = await w.list.execute({ page: 1, pageSize: 20, access: ida });
    expect(list.items.map((s) => s.id)).toEqual([mine.id]);
    await expect(w.get.execute({ id: mine.id, access: ida })).resolves.toMatchObject({ id: mine.id });
    const foreign = await w.get.execute({ id: other.id, access: ida }).then(() => null, (e: unknown) => e as DomainError);
    const missing = await w.get.execute({ id: 'inconnue', access: ida }).then(() => null, (e: unknown) => e as DomainError);
    expect(foreign).toBeInstanceOf(DomainError);
    expect([foreign?.code, foreign?.message]).toEqual([missing?.code, missing?.message]);
    // Un formateur sans compte lié (externe) n'est visible d'aucun formateur ; un utilisateur sans formateur ne voit rien.
    expect((await w.list.execute({ page: 1, pageSize: 20, access: as(RoleCode.Trainer, 'user-sans-fiche') })).total).toBe(0);
  });

  it('les autres rôles de lecture voient toutes les sessions', async () => {
    const w = await build();
    await w.plan.execute(base(w));
    await w.plan.execute(base(w, { startDate: '2026-11-23', trainerId: w.externe.id }));
    for (const role of [RoleCode.Direction, RoleCode.AccountManager, RoleCode.HeadOfSales, RoleCode.TrainingManager]) {
      expect((await w.list.execute({ page: 1, pageSize: 20, access: as(role, 'x') })).total).toBe(2);
    }
  });

  it('déduit la phase des dates : à venir, en cours, terminée', async () => {
    const w = await build();
    const view = await w.plan.execute(base(w));
    expect(view.phase).toBe('UPCOMING');
    currentNow = new Date('2026-11-18T09:00:00Z');
    expect((await w.get.execute({ id: view.id, access: as(RoleCode.TrainingManager, 'x') })).phase).toBe('IN_PROGRESS');
    currentNow = new Date('2026-11-21T09:00:00Z');
    expect((await w.get.execute({ id: view.id, access: as(RoleCode.TrainingManager, 'x') })).phase).toBe('ENDED');
  });
});
