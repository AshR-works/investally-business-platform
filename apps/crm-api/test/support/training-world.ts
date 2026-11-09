import { CancelEnrollmentUseCase, ConfirmEnrollmentUseCase, EnrollLearnerUseCase, EnrollmentRules, EnrollmentViews, GetEnrollmentHandler, ListApprovalOptionsHandler, ListEnrollmentsHandler, ReplaceEnrollmentUseCase } from '../../src/modules/training/application/enrollment-use-cases';
import { DeleteLearnerUseCase, GetLearnerHandler, ListLearnersHandler, RegisterLearnerUseCase, UpdateLearnerUseCase } from '../../src/modules/training/application/learner-use-cases';
import {
  ChangeRoomStatusUseCase, ChangeTrainerStatusUseCase, ChangeTrainingStatusUseCase, CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase, CreateTrainerUseCase, CreateTrainingUseCase,
  TrainingViews, UpdateRoomUseCase, UpdateTrainerUseCase,
} from '../../src/modules/training/application/catalogue-use-cases';
import {
  CancelSessionUseCase, GetSessionHandler, ListSessionsHandler, OpenSessionUseCase, PlanSessionUseCase, PostponeSessionUseCase, SessionRules, SessionViews, UpdateSessionUseCase,
} from '../../src/modules/training/application/session-use-cases';
import { ActorContext } from '../../src/shared-kernel';
import { AuditRecord } from '../../src/modules/audit';
import { InMemoryModules, InMemoryPrograms, InMemoryRooms, InMemoryTrainers, InMemoryTrainings } from './in-memory-catalogue';
import { InMemoryDirectory, InMemoryEnrollments, InMemoryLearners } from './in-memory-enrollments';
import { InMemorySessions } from './in-memory-sessions';

export const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };

/**
 * Monde de test du module Formation : dépôts en mémoire, annuaire du module commercial et tous les cas d'usage (catalogue, sessions, apprenants,
 * inscriptions), avec un catalogue prêt (deux certificats, deux salles, deux formateurs). L'horloge est fournie par le test.
 */
export async function buildTrainingWorld(clock: { now: () => Date }) {
  const programs = new InMemoryPrograms();
  const trainings = new InMemoryTrainings(programs);
  programs.trainings = trainings;
  const modules = new InMemoryModules();
  const rooms = new InMemoryRooms();
  const trainers = new InMemoryTrainers();
  const sessions = new InMemorySessions(trainers);
  const directory = new InMemoryDirectory();
  const learners = new InMemoryLearners(directory);
  const enrollments = new InMemoryEnrollments(sessions, directory);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const ids = { next: () => `id-${++seq}` };
  const trainingViews = new TrainingViews(programs, modules);
  const views = new SessionViews(trainings, programs, modules, rooms, trainers, clock, enrollments);
  const rules = new SessionRules(trainings, modules, rooms, trainers, sessions, enrollments);
  const enrollmentViews = new EnrollmentViews(sessions, trainings, rooms, learners, directory);
  const enrollmentRules = new EnrollmentRules(enrollments, sessions, trainings, directory);

  const createProgram = new CreateProgramUseCase(programs, recorder, unitOfWork, clock, ids);
  const createModule = new CreateModuleUseCase(modules, recorder, unitOfWork, clock, ids);
  const createTraining = new CreateTrainingUseCase(trainings, programs, modules, trainingViews, recorder, unitOfWork, clock, ids);
  const createRoom = new CreateRoomUseCase(rooms, recorder, unitOfWork, clock, ids);
  const createTrainer = new CreateTrainerUseCase(trainers, recorder, unitOfWork, clock, ids);

  const program = await createProgram.execute({ name: 'Marchés financiers', actor });
  const magistral = await createModule.execute({ title: 'Introduction aux marchés', requiresWorkstations: false, actor });
  const pratique = await createModule.execute({ title: 'Trading sur poste', requiresWorkstations: true, actor });
  const certTheory = await createTraining.execute({ programId: program.id, title: 'Certificat théorique', moduleIds: [magistral.id], priceAmount: '250000', actor });
  const certTrading = await createTraining.execute({ programId: program.id, title: 'Certificat trading', moduleIds: [magistral.id, pratique.id], priceAmount: '750000', actor });
  const salleMarches = await createRoom.execute({ name: 'Salle de marchés', kind: 'WORKSTATIONS', learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, actor });
  const salleCours = await createRoom.execute({ name: 'Salle de réunion', kind: 'CLASSROOM', learnerSeats: 16, trainerSeats: 0, actor });
  const interne = await createTrainer.execute({ lastName: 'Interne', firstName: 'Ida', userId: 'user-ida', actor });
  const externe = await createTrainer.execute({ lastName: 'Externe', firstName: 'Eli', email: 'eli@formateurs.test', actor });

  return {
    program, createTraining, audit, sessions, enrollments, learners, directory, certTheory, certTrading, salleMarches, salleCours, interne, externe, rooms, trainers, trainings,
    plan: new PlanSessionUseCase(sessions, rules, views, recorder, unitOfWork, clock, ids),
    update: new UpdateSessionUseCase(sessions, rules, views, recorder, unitOfWork, clock),
    open: new OpenSessionUseCase(sessions, views, recorder, unitOfWork),
    postpone: new PostponeSessionUseCase(sessions, rules, views, recorder, unitOfWork, clock),
    cancel: new CancelSessionUseCase(sessions, enrollments, views, recorder, unitOfWork),
    get: new GetSessionHandler(sessions, trainers, views),
    list: new ListSessionsHandler(sessions, views),
    updateRoom: new UpdateRoomUseCase(rooms, recorder, unitOfWork),
    statusRoom: new ChangeRoomStatusUseCase(rooms, recorder, unitOfWork),
    statusTrainer: new ChangeTrainerStatusUseCase(trainers, recorder, unitOfWork),
    statusTraining: new ChangeTrainingStatusUseCase(trainings, programs, trainingViews, recorder, unitOfWork),
    updateTrainer: new UpdateTrainerUseCase(trainers, recorder, unitOfWork),
    registerLearner: new RegisterLearnerUseCase(learners, directory, recorder, unitOfWork, clock, ids),
    updateLearner: new UpdateLearnerUseCase(learners, directory, recorder, unitOfWork),
    deleteLearner: new DeleteLearnerUseCase(learners, enrollments, directory, recorder, unitOfWork, clock),
    getLearner: new GetLearnerHandler(learners, directory),
    listLearners: new ListLearnersHandler(learners, directory),
    enroll: new EnrollLearnerUseCase(enrollments, learners, sessions, directory, enrollmentRules, enrollmentViews, recorder, unitOfWork, clock, ids),
    confirm: new ConfirmEnrollmentUseCase(enrollments, sessions, directory, enrollmentViews, recorder, unitOfWork, clock),
    cancelEnrollment: new CancelEnrollmentUseCase(enrollments, sessions, directory, enrollmentViews, recorder, unitOfWork),
    replace: new ReplaceEnrollmentUseCase(enrollments, learners, sessions, directory, enrollmentRules, enrollmentViews, recorder, unitOfWork, clock, ids),
    getEnrollment: new GetEnrollmentHandler(enrollments, directory, enrollmentViews),
    listEnrollments: new ListEnrollmentsHandler(enrollments, learners, directory, enrollmentViews),
    approvalOptions: new ListApprovalOptionsHandler(enrollments, learners, sessions, trainings, directory),
  };
}
export type TrainingWorld = Awaited<ReturnType<typeof buildTrainingWorld>>;
