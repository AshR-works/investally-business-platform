import { InMemoryModules, InMemoryPrograms, InMemoryRooms, InMemoryTrainers, InMemoryTrainings } from '../../../../test/support/in-memory-catalogue';
import { ActorContext, DomainError } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import {
  ChangeModuleStatusUseCase, ChangeProgramStatusUseCase, ChangeRoomStatusUseCase, ChangeTrainingStatusUseCase, CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase,
  CreateTrainerUseCase, CreateTrainingUseCase, GetProgramHandler, ListProgramsHandler, ListRhythmsHandler, ListTrainingsHandler, TrainingViews, UpdateModuleUseCase,
  UpdateProgramUseCase, UpdateRoomUseCase, UpdateTrainerUseCase, UpdateTrainingUseCase,
} from './catalogue-use-cases';

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const now = new Date('2026-11-12T10:00:00Z');

function build() {
  const programs = new InMemoryPrograms();
  const trainings = new InMemoryTrainings(programs);
  programs.trainings = trainings;
  const modules = new InMemoryModules();
  const rooms = new InMemoryRooms();
  const trainers = new InMemoryTrainers();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `id-${++seq}` };
  const views = new TrainingViews(programs, modules);
  return {
    programs, trainings, modules, rooms, trainers, audit,
    createProgram: new CreateProgramUseCase(programs, recorder, unitOfWork, clock, ids),
    updateProgram: new UpdateProgramUseCase(programs, recorder, unitOfWork),
    statusProgram: new ChangeProgramStatusUseCase(programs, recorder, unitOfWork),
    getProgram: new GetProgramHandler(programs),
    listPrograms: new ListProgramsHandler(programs),
    createTraining: new CreateTrainingUseCase(trainings, programs, modules, views, recorder, unitOfWork, clock, ids),
    updateTraining: new UpdateTrainingUseCase(trainings, modules, views, recorder, unitOfWork),
    statusTraining: new ChangeTrainingStatusUseCase(trainings, programs, views, recorder, unitOfWork),
    listTrainings: new ListTrainingsHandler(trainings, modules),
    createModule: new CreateModuleUseCase(modules, recorder, unitOfWork, clock, ids),
    updateModule: new UpdateModuleUseCase(modules, recorder, unitOfWork),
    statusModule: new ChangeModuleStatusUseCase(modules, recorder, unitOfWork),
    createRoom: new CreateRoomUseCase(rooms, recorder, unitOfWork, clock, ids),
    updateRoom: new UpdateRoomUseCase(rooms, recorder, unitOfWork),
    statusRoom: new ChangeRoomStatusUseCase(rooms, recorder, unitOfWork),
    createTrainer: new CreateTrainerUseCase(trainers, recorder, unitOfWork, clock, ids),
    updateTrainer: new UpdateTrainerUseCase(trainers, recorder, unitOfWork),
  };
}

const rejects = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  if (message) expect((error as DomainError).message).toMatch(message);
};

describe('Catalogue — programmes', () => {
  it('crée un programme actif, trace la création et refuse un nom déjà pris sans tenir compte de la casse', async () => {
    const w = build();
    const view = await w.createProgram.execute({ name: '  Gestion   de projet ', audience: 'Cadres', actor });
    expect(view).toMatchObject({ name: 'Gestion de projet', audience: 'Cadres', status: 'ACTIVE', version: 1, activeTrainings: 0 });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Program', module: 'training' });
    await rejects(w.createProgram.execute({ name: 'GESTION DE PROJET', actor }), 'CONFLICT', /existe déjà/);
    expect(w.programs.items).toHaveLength(1);
  });

  it('refuse un nom vide ou trop long, une description trop longue', async () => {
    const w = build();
    await rejects(w.createProgram.execute({ name: '   ', actor }), 'VALIDATION', /obligatoire/);
    await rejects(w.createProgram.execute({ name: 'x'.repeat(151), actor }), 'VALIDATION', /150/);
    await rejects(w.createProgram.execute({ name: 'A', description: 'x'.repeat(2001), actor }), 'VALIDATION', /2000/);
    expect(w.programs.items).toHaveLength(0);
  });

  it('modifie : champ absent inchangé, texte vide effacé ; ancienne et nouvelle valeur tracées ; version périmée = conflit', async () => {
    const w = build();
    const p = await w.createProgram.execute({ name: 'Finance', description: 'Bases', audience: 'DAF', actor });
    const view = await w.updateProgram.execute({ id: p.id, version: 1, description: '', actor });
    expect(view).toMatchObject({ name: 'Finance', description: null, audience: 'DAF' });
    expect(w.audit[1]).toMatchObject({ action: AuditAction.Update, oldValue: { description: 'Bases' }, newValue: { description: null } });
    await rejects(w.updateProgram.execute({ id: p.id, version: 7, name: 'Autre', actor }), 'CONFLICT', /modifié par un autre/);
  });

  it('refuse de renommer vers le nom d’un autre programme, accepte de garder le sien', async () => {
    const w = build();
    await w.createProgram.execute({ name: 'Finance', actor });
    const b = await w.createProgram.execute({ name: 'Marketing', actor });
    await rejects(w.updateProgram.execute({ id: b.id, version: 1, name: 'finance', actor }), 'CONFLICT');
    await expect(w.updateProgram.execute({ id: b.id, version: 1, name: 'MARKETING', actor })).resolves.toMatchObject({ name: 'MARKETING' });
  });

  it('archive puis réactive ; un programme archivé ne se modifie plus ; double archivage refusé', async () => {
    const w = build();
    const p = await w.createProgram.execute({ name: 'Finance', actor });
    expect(await w.statusProgram.execute({ id: p.id, version: 1, action: 'archive', actor })).toMatchObject({ status: 'ARCHIVED' });
    await rejects(w.updateProgram.execute({ id: p.id, version: 1, name: 'X', actor }), 'INVARIANT_VIOLATION', /archivé/);
    await rejects(w.statusProgram.execute({ id: p.id, version: 1, action: 'archive', actor }), 'INVARIANT_VIOLATION', /déjà archivé/);
    expect(await w.statusProgram.execute({ id: p.id, version: 1, action: 'reactivate', actor })).toMatchObject({ status: 'ACTIVE' });
    await rejects(w.getProgram.execute({ id: 'inconnu' }), 'NOT_FOUND');
  });

  it('la liste filtre par état et compte les formations actives de chaque programme', async () => {
    const w = build();
    const a = await w.createProgram.execute({ name: 'Finance', actor });
    const b = await w.createProgram.execute({ name: 'Marketing', actor });
    await w.createTraining.execute({ programId: a.id, title: 'Comptabilité', actor });
    const second = await w.createTraining.execute({ programId: a.id, title: 'Budget', actor });
    await w.statusTraining.execute({ id: second.id, version: 1, action: 'archive', actor });
    await w.statusProgram.execute({ id: b.id, version: 1, action: 'archive', actor });
    const all = await w.listPrograms.execute({ page: 1, pageSize: 20 });
    expect(all.items.map((p) => [p.name, p.activeTrainings])).toEqual([['Finance', 1], ['Marketing', 0]]);
    expect((await w.listPrograms.execute({ page: 1, pageSize: 20, status: 'ACTIVE' })).items.map((p) => p.name)).toEqual(['Finance']);
  });
});

describe('Catalogue — certificats', () => {
  async function withProgram() {
    const w = build();
    const program = await w.createProgram.execute({ name: 'Marchés financiers', actor });
    return { w, program };
  }

  it('crée un certificat dans un programme actif : tarifs (complet et par module) dans une même devise, XAF par défaut', async () => {
    const { w, program } = await withProgram();
    const view = await w.createTraining.execute({ programId: program.id, title: 'Certificat Expert(e)', prerequisites: 'Aucun', priceAmount: '750000', modulePriceAmount: '125000', actor });
    expect(view).toMatchObject({ programName: 'Marchés financiers', pricing: { currency: 'XAF', full: '750000.00', perModule: '125000.00' }, status: 'ACTIVE', modules: [] });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Training' });
  });

  it('accepte un seul des deux prix, une devise explicite et la virgule décimale', async () => {
    const { w, program } = await withProgram();
    await expect(w.createTraining.execute({ programId: program.id, title: 'A', priceAmount: '1200,5', priceCurrency: 'eur', actor })).resolves.toMatchObject({ pricing: { currency: 'EUR', full: '1200.50', perModule: null } });
    await expect(w.createTraining.execute({ programId: program.id, title: 'B', modulePriceAmount: '75000', actor })).resolves.toMatchObject({ pricing: { currency: 'XAF', full: null, perModule: '75000.00' } });
    await expect(w.createTraining.execute({ programId: program.id, title: 'C', actor })).resolves.toMatchObject({ pricing: null });
  });

  it('refuse un prix nul, négatif, à trois décimales, ou une devise sans prix', async () => {
    const { w, program } = await withProgram();
    for (const priceAmount of ['0', '-5', '10.123', 'abc']) {
      await rejects(w.createTraining.execute({ programId: program.id, title: `T${priceAmount}`, priceAmount, actor }), 'VALIDATION', /prix complet/);
      await rejects(w.createTraining.execute({ programId: program.id, title: `M${priceAmount}`, modulePriceAmount: priceAmount, actor }), 'VALIDATION', /prix par module/);
    }
    await rejects(w.createTraining.execute({ programId: program.id, title: 'Sans montant', priceCurrency: 'XAF', actor }), 'VALIDATION', /devise/);
    await rejects(w.createTraining.execute({ programId: program.id, title: 'Mauvaise', priceAmount: '100', priceCurrency: 'FCFA', actor }), 'VALIDATION', /trois lettres/);
  });

  it('un programme archivé ou inconnu n’accepte pas de certificat', async () => {
    const { w, program } = await withProgram();
    await w.statusProgram.execute({ id: program.id, version: 1, action: 'archive', actor });
    await rejects(w.createTraining.execute({ programId: program.id, title: 'A', actor }), 'INVARIANT_VIOLATION', /archivé/);
    await rejects(w.createTraining.execute({ programId: 'inconnu', title: 'A', actor }), 'NOT_FOUND');
  });

  it('le titre est unique dans un programme (sans casse) mais peut se répéter dans un autre', async () => {
    const { w, program } = await withProgram();
    const other = await w.createProgram.execute({ name: 'Marketing', actor });
    await w.createTraining.execute({ programId: program.id, title: 'Initiation', actor });
    await rejects(w.createTraining.execute({ programId: program.id, title: 'INITIATION', actor }), 'CONFLICT', /déjà un certificat/);
    await expect(w.createTraining.execute({ programId: other.id, title: 'Initiation', actor })).resolves.toMatchObject({ programName: 'Marketing' });
  });

  it('modifie les prix, retire un prix (null), efface les prérequis ; le programme ne change pas', async () => {
    const { w, program } = await withProgram();
    const t = await w.createTraining.execute({ programId: program.id, title: 'A', prerequisites: 'Bac', priceAmount: '1000', modulePriceAmount: '300', actor });
    const view = await w.updateTraining.execute({ id: t.id, version: 1, prerequisites: '', priceAmount: null, actor });
    expect(view).toMatchObject({ prerequisites: null, pricing: { currency: 'XAF', full: null, perModule: '300.00' }, programId: program.id });
    const none = await w.updateTraining.execute({ id: t.id, version: 1, modulePriceAmount: null, actor });
    expect(none.pricing).toBeNull();
    await rejects(w.updateTraining.execute({ id: t.id, version: 9, title: 'Z', actor }), 'CONFLICT');
  });

  it('changer seulement la devise garde les montants ; changer seulement un montant garde la devise', async () => {
    const { w, program } = await withProgram();
    const t = await w.createTraining.execute({ programId: program.id, title: 'A', priceAmount: '1000', modulePriceAmount: '300', priceCurrency: 'EUR', actor });
    expect((await w.updateTraining.execute({ id: t.id, version: 1, priceAmount: '1500', actor })).pricing).toEqual({ currency: 'EUR', full: '1500.00', perModule: '300.00' });
    expect((await w.updateTraining.execute({ id: t.id, version: 1, priceCurrency: 'XAF', actor })).pricing).toEqual({ currency: 'XAF', full: '1500.00', perModule: '300.00' });
  });

  it('on ne réactive pas un certificat dont le programme est archivé ; la liste peut se limiter à un programme', async () => {
    const { w, program } = await withProgram();
    const t = await w.createTraining.execute({ programId: program.id, title: 'A', actor });
    await w.statusTraining.execute({ id: t.id, version: 1, action: 'archive', actor });
    await w.statusProgram.execute({ id: program.id, version: 1, action: 'archive', actor });
    await rejects(w.statusTraining.execute({ id: t.id, version: 1, action: 'reactivate', actor }), 'INVARIANT_VIOLATION', /programme est archivé/);
    expect((await w.listTrainings.execute({ page: 1, pageSize: 10, programId: 'autre' })).items).toEqual([]);
    expect((await w.listTrainings.execute({ page: 1, pageSize: 10, programId: program.id })).items).toHaveLength(1);
  });

  it('les modules d’un certificat sont ordonnés ; la liste complète est remplacée à chaque modification, l’ordre étant celui demandé', async () => {
    const { w, program } = await withProgram();
    const [m1, m2, m3] = [await w.createModule.execute({ title: 'Fondations', actor }), await w.createModule.execute({ title: 'Instruments', actor }), await w.createModule.execute({ title: 'Réglementation', actor })];
    const t = await w.createTraining.execute({ programId: program.id, title: 'Expert', moduleIds: [m3.id, m1.id], actor });
    expect(t.modules.map((m) => [m.position, m.title])).toEqual([[1, 'Réglementation'], [2, 'Fondations']]);
    const reordered = await w.updateTraining.execute({ id: t.id, version: 1, moduleIds: [m1.id, m2.id, m3.id], actor });
    expect(reordered.modules.map((m) => m.title)).toEqual(['Fondations', 'Instruments', 'Réglementation']);
    expect((await w.updateTraining.execute({ id: t.id, version: 1, moduleIds: [] , actor })).modules).toEqual([]);
    const listed = await w.listTrainings.execute({ page: 1, pageSize: 10 });
    expect(listed.items[0]!.modules).toEqual([]);
  });

  it('un module absent, en double, ou plus de 20 modules sont refusés ; un module archivé ne s’ajoute pas mais peut rester', async () => {
    const { w, program } = await withProgram();
    const m1 = await w.createModule.execute({ title: 'Fondations', actor });
    const m2 = await w.createModule.execute({ title: 'Instruments', actor });
    await rejects(w.createTraining.execute({ programId: program.id, title: 'A', moduleIds: ['inconnu'], actor }), 'NOT_FOUND', /Module introuvable/);
    await rejects(w.createTraining.execute({ programId: program.id, title: 'B', moduleIds: [m1.id, m1.id], actor }), 'VALIDATION', /qu’une fois/);
    const many = Array.from({ length: 21 }, (_, i) => `m${i}`);
    await rejects(w.createTraining.execute({ programId: program.id, title: 'C', moduleIds: many, actor }), 'VALIDATION', /20 modules/);
    const t = await w.createTraining.execute({ programId: program.id, title: 'D', moduleIds: [m1.id], actor });
    await w.statusModule.execute({ id: m1.id, version: 1, action: 'archive', actor });
    await rejects(w.createTraining.execute({ programId: program.id, title: 'E', moduleIds: [m1.id], actor }), 'INVARIANT_VIOLATION', /archivé/);
    // Conserver le module archivé déjà présent est permis ; en ajouter un second actif aussi.
    const kept = await w.updateTraining.execute({ id: t.id, version: 1, moduleIds: [m1.id, m2.id], actor });
    expect(kept.modules.map((m) => [m.title, m.status])).toEqual([['Fondations', 'ARCHIVED'], ['Instruments', 'ACTIVE']]);
  });
});

describe('Catalogue — modules et rythmes', () => {
  it('crée un module (titre unique sans casse), le modifie, l’archive et le réactive', async () => {
    const w = build();
    const m = await w.createModule.execute({ title: ' Fondations  Économiques ', description: 'Bases', actor });
    expect(m).toMatchObject({ title: 'Fondations Économiques', description: 'Bases', status: 'ACTIVE', version: 1 });
    await rejects(w.createModule.execute({ title: 'FONDATIONS ÉCONOMIQUES', actor }), 'CONFLICT', /existe déjà/);
    await rejects(w.createModule.execute({ title: '  ', actor }), 'VALIDATION', /obligatoire/);
    await rejects(w.createModule.execute({ title: 'x'.repeat(151), actor }), 'VALIDATION', /150/);
    expect(await w.updateModule.execute({ id: m.id, version: 1, description: '', actor })).toMatchObject({ description: null });
    await rejects(w.updateModule.execute({ id: m.id, version: 5, title: 'Z', actor }), 'CONFLICT');
    expect(await w.statusModule.execute({ id: m.id, version: 1, action: 'archive', actor })).toMatchObject({ status: 'ARCHIVED' });
    await rejects(w.updateModule.execute({ id: m.id, version: 1, title: 'Z', actor }), 'INVARIANT_VIOLATION', /archivé/);
    expect(await w.statusModule.execute({ id: m.id, version: 1, action: 'reactivate', actor })).toMatchObject({ status: 'ACTIVE' });
    expect(w.audit.map((a) => a.entityType)).toEqual(['Module', 'Module', 'Module', 'Module']);
  });

  it('un module est magistral par défaut ; on peut le déclarer pratique sur poste, puis le rendre magistral', async () => {
    const w = build();
    const lecture = await w.createModule.execute({ title: 'Fondations', actor });
    const practice = await w.createModule.execute({ title: 'Pratique du Trading', requiresWorkstations: true, actor });
    expect([lecture.requiresWorkstations, practice.requiresWorkstations]).toEqual([false, true]);
    expect((await w.updateModule.execute({ id: lecture.id, version: 1, requiresWorkstations: true, actor })).requiresWorkstations).toBe(true);
    expect((await w.updateModule.execute({ id: practice.id, version: 1, requiresWorkstations: false, actor })).requiresWorkstations).toBe(false);
    expect((await w.updateModule.execute({ id: practice.id, version: 1, title: 'Autre titre', actor })).requiresWorkstations).toBe(false);
  });

  it('deux rythmes : jour (1 semaine, 9h-12h puis 13h-17h, ouvert) et soir (2 semaines, 18h-21h, pas encore ouvert) ; volumes horaires calculés', () => {
    const rhythms = new ListRhythmsHandler().execute();
    expect(rhythms.map((r) => [r.code, r.weeks, r.slots, r.open, r.totalHours])).toEqual([
      ['DAY', 1, ['09:00-12:00', '13:00-17:00'], true, 35],
      ['EVENING', 2, ['18:00-21:00'], false, 30],
    ]);
  });
});

describe('Catalogue — salles', () => {
  it('crée la salle de marchés : 14 postes apprenants dont 1 en panne, 1 poste formateur ; capacité utile 13', async () => {
    const w = build();
    const room = await w.createRoom.execute({ name: 'Salle de marchés', learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, equipment: 'Terminaux de marché', actor });
    expect(room).toMatchObject({ learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, usableSeats: 13, status: 'ACTIVE' });
    expect(w.audit).toHaveLength(1);
  });

  it('la salle de réunion : salle de cours de 16 places, sans poste formateur, écran 65 pouces ; le type est « avec postes » par défaut et modifiable', async () => {
    const w = build();
    const meeting = await w.createRoom.execute({ name: 'Salle de réunion', kind: 'CLASSROOM', learnerSeats: 16, trainerSeats: 0, equipment: 'Écran 65 pouces', actor });
    expect(meeting).toMatchObject({ kind: 'CLASSROOM', learnerSeats: 16, usableSeats: 16, trainerSeats: 0, equipment: 'Écran 65 pouces' });
    const markets = await w.createRoom.execute({ name: 'Salle de marchés', learnerSeats: 14, actor });
    expect(markets.kind).toBe('WORKSTATIONS');
    expect((await w.updateRoom.execute({ id: markets.id, version: 1, kind: 'CLASSROOM', actor })).kind).toBe('CLASSROOM');
    expect((await w.updateRoom.execute({ id: markets.id, version: 1, name: 'Salle B', actor })).kind).toBe('CLASSROOM');
  });

  it('postes hors service 0 et poste formateur 1 par défaut ; nom unique sans casse', async () => {
    const w = build();
    expect(await w.createRoom.execute({ name: 'Salle Douala', learnerSeats: 25, actor })).toMatchObject({ unavailableSeats: 0, trainerSeats: 1, usableSeats: 25 });
    await rejects(w.createRoom.execute({ name: 'salle douala', learnerSeats: 10, actor }), 'CONFLICT');
  });

  it('refuse des postes apprenants hors de 1 à 1000, des postes hors service au-delà des postes apprenants, trop de postes formateur', async () => {
    const w = build();
    for (const learnerSeats of [0, 1001, 2.5]) await rejects(w.createRoom.execute({ name: `S${learnerSeats}`, learnerSeats, actor }), 'VALIDATION', /postes apprenants/);
    await rejects(w.createRoom.execute({ name: 'A', learnerSeats: 10, unavailableSeats: 11, actor }), 'VALIDATION', /dépasser/);
    await rejects(w.createRoom.execute({ name: 'B', learnerSeats: 10, unavailableSeats: -1, actor }), 'VALIDATION', /hors service/);
    await rejects(w.createRoom.execute({ name: 'C', learnerSeats: 10, trainerSeats: 11, actor }), 'VALIDATION', /formateur/);
    expect(w.rooms.items).toHaveLength(0);
  });

  it('déclarer un poste en panne puis réparé met à jour la capacité utile ; on ne peut pas réduire les postes sous les pannes', async () => {
    const w = build();
    const room = await w.createRoom.execute({ name: 'Salle de marchés', learnerSeats: 14, actor });
    expect(await w.updateRoom.execute({ id: room.id, version: 1, unavailableSeats: 2, actor })).toMatchObject({ usableSeats: 12 });
    expect(await w.updateRoom.execute({ id: room.id, version: 1, unavailableSeats: 0, actor })).toMatchObject({ usableSeats: 14 });
    await w.updateRoom.execute({ id: room.id, version: 1, unavailableSeats: 3, actor });
    await rejects(w.updateRoom.execute({ id: room.id, version: 1, learnerSeats: 2, actor }), 'VALIDATION', /dépasser/);
  });

  it('désactive (reste lisible), refuse la modification d’une salle désactivée, puis réactive', async () => {
    const w = build();
    const room = await w.createRoom.execute({ name: 'A', learnerSeats: 10, actor });
    expect(await w.statusRoom.execute({ id: room.id, version: 1, action: 'archive', actor })).toMatchObject({ status: 'ARCHIVED' });
    await rejects(w.updateRoom.execute({ id: room.id, version: 1, learnerSeats: 12, actor }), 'INVARIANT_VIOLATION', /archivé/);
    expect(await w.statusRoom.execute({ id: room.id, version: 1, action: 'reactivate', actor })).toMatchObject({ status: 'ACTIVE' });
    await expect(w.updateRoom.execute({ id: room.id, version: 1, learnerSeats: 12, actor })).resolves.toMatchObject({ learnerSeats: 12 });
  });
});

describe('Catalogue — formateurs', () => {
  const base = { lastName: 'Mballa', firstName: 'Estelle', specialties: 'Gestion de projet' };

  it('crée un formateur externe (sans compte) et un interne (compte lié) ; e-mail normalisé en minuscules', async () => {
    const w = build();
    const external = await w.createTrainer.execute({ ...base, email: 'Estelle.Mballa@exemple.test', phone: '+237 6 70 11 22 33', actor });
    expect(external).toMatchObject({ email: 'estelle.mballa@exemple.test', phone: '+237670112233', internal: false, userId: null });
    const internal = await w.createTrainer.execute({ lastName: 'Kamga', firstName: 'Paul', userId: '3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60', actor });
    expect(internal).toMatchObject({ internal: true });
  });

  it('refuse un e-mail invalide, un téléphone invalide, un e-mail déjà pris, un compte déjà lié', async () => {
    const w = build();
    await w.createTrainer.execute({ ...base, email: 'a@exemple.test', userId: '3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60', actor });
    await rejects(w.createTrainer.execute({ lastName: 'X', firstName: 'Y', email: 'pas-un-email', actor }), 'VALIDATION', /e-mail/);
    await rejects(w.createTrainer.execute({ lastName: 'X', firstName: 'Y', phone: '12', actor }), 'VALIDATION');
    await rejects(w.createTrainer.execute({ lastName: 'X', firstName: 'Y', email: 'A@exemple.test', actor }), 'CONFLICT', /e-mail/);
    await rejects(w.createTrainer.execute({ lastName: 'X', firstName: 'Y', userId: '3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60', actor }), 'CONFLICT', /compte/);
    expect(w.trainers.items).toHaveLength(1);
  });

  it('modifie : délie le compte (null), efface le téléphone, garde son propre e-mail sans conflit', async () => {
    const w = build();
    const t = await w.createTrainer.execute({ ...base, email: 'a@exemple.test', phone: '+237670112233', userId: '3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60', actor });
    const view = await w.updateTrainer.execute({ id: t.id, version: 1, userId: null, phone: '', email: 'a@exemple.test', actor });
    expect(view).toMatchObject({ internal: false, phone: null, email: 'a@exemple.test' });
    await rejects(w.updateTrainer.execute({ id: 'inconnu', version: 1, lastName: 'Z', actor }), 'NOT_FOUND');
  });
});
