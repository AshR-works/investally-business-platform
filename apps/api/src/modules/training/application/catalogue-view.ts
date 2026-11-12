import { CatalogueStatus } from '../domain/catalogue-fields';
import { CourseModule } from '../domain/course-module';
import { Program } from '../domain/program';
import { Rhythm, totalHours } from '../domain/rhythms';
import { Room, RoomKind } from '../domain/room';
import { Trainer } from '../domain/trainer';
import { Training } from '../domain/training';

export interface ProgramView {
  id: string;
  name: string;
  description: string | null;
  audience: string | null;
  status: CatalogueStatus;
  /** Nombre de certificats actifs du programme (lecture seule). */
  activeTrainings: number;
  version: number;
  createdAt: string;
}

export interface ModuleView {
  id: string;
  title: string;
  description: string | null;
  requiresWorkstations: boolean;
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

export interface TrainingModuleView {
  id: string;
  title: string;
  position: number;
  status: CatalogueStatus;
}

export interface TrainingView {
  id: string;
  programId: string;
  programName: string;
  title: string;
  objectives: string | null;
  prerequisites: string | null;
  /** Tarifs dans une même devise : prix complet et prix de chaque module (le complet n'est pas la somme des modules). */
  pricing: { currency: string; full: string | null; perModule: string | null } | null;
  modules: TrainingModuleView[];
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

export interface RoomView {
  id: string;
  name: string;
  kind: RoomKind;
  learnerSeats: number;
  unavailableSeats: number;
  trainerSeats: number;
  /** Places utilisables par les apprenants : postes apprenants − postes hors service. */
  usableSeats: number;
  equipment: string | null;
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

export interface TrainerView {
  id: string;
  lastName: string;
  firstName: string;
  specialties: string | null;
  email: string | null;
  phone: string | null;
  userId: string | null;
  /** Formateur interne (compte lié) ou externe. */
  internal: boolean;
  status: CatalogueStatus;
  version: number;
  createdAt: string;
}

export interface RhythmView extends Rhythm {
  totalHours: number;
}

export const toProgramView = (p: Program, activeTrainings = 0): ProgramView => ({
  id: p.id, name: p.name, description: p.description, audience: p.audience, status: p.status, activeTrainings, version: p.version, createdAt: p.createdAt.toISOString(),
});

export const toModuleView = (m: CourseModule): ModuleView => ({
  id: m.id, title: m.title, description: m.description, requiresWorkstations: m.requiresWorkstations, status: m.status, version: m.version, createdAt: m.createdAt.toISOString(),
});

/** Les modules d'un certificat dans l'ordre de ce dernier ; un module introuvable (jamais en pratique : clé étrangère) est omis. */
export function toTrainingView(t: Training, programName: string, modules: readonly CourseModule[]): TrainingView {
  const byId = new Map(modules.map((m) => [m.id, m]));
  return {
    id: t.id, programId: t.programId, programName, title: t.title, objectives: t.objectives, prerequisites: t.prerequisites, pricing: t.pricing,
    modules: t.moduleIds.flatMap((id, index) => {
      const m = byId.get(id);
      return m ? [{ id, title: m.title, position: index + 1, status: m.status }] : [];
    }),
    status: t.status, version: t.version, createdAt: t.createdAt.toISOString(),
  };
}

export const toRoomView = (r: Room): RoomView => ({
  id: r.id, name: r.name, kind: r.kind, learnerSeats: r.learnerSeats, unavailableSeats: r.unavailableSeats, trainerSeats: r.trainerSeats, usableSeats: r.usableSeats,
  equipment: r.equipment, status: r.status, version: r.version, createdAt: r.createdAt.toISOString(),
});

export const toTrainerView = (t: Trainer): TrainerView => ({
  id: t.id, lastName: t.lastName, firstName: t.firstName, specialties: t.specialties, email: t.email, phone: t.phone, userId: t.userId,
  internal: t.userId !== null, status: t.status, version: t.version, createdAt: t.createdAt.toISOString(),
});

export const toRhythmView = (r: Rhythm): RhythmView => ({ ...r, totalHours: totalHours(r) });
