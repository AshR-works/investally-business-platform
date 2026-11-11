import { Page } from '../../../shared-kernel';
import { IsoDate } from './session-dates';
import { SessionStatus, TrainingSession } from './training-session';

export interface SessionListQuery {
  page: number;
  pageSize: number;
  status?: SessionStatus;
  roomId?: string;
  trainerId?: string;
  trainingId?: string;
  /** Sessions qui recouvrent la période [from, to] (bornes incluses ; l'une ou l'autre peut manquer). */
  from?: IsoDate;
  to?: IsoDate;
  /** Si présent : seules les sessions dont le formateur est lié à l'un de ces comptes (formateur : « Propre »). */
  visibleToUserIds?: readonly string[];
}

/**
 * Port de persistance des sessions. `save` crée ou met à jour : une version périmée est un conflit. Le contrôle de chevauchement se fait
 * dans la même transaction que l'enregistrement, après `lockResources` (qui sérialise les planifications concurrentes d'une même salle
 * ou d'un même formateur).
 */
export interface SessionRepository {
  save(session: TrainingSession): Promise<void>;
  findById(id: string): Promise<TrainingSession | null>;
  /** Verrouille la salle puis le formateur (ordre fixe : pas d'interblocage) jusqu'à la fin de la transaction. */
  lockResources(roomId: string, trainerId: string): Promise<void>;
  /** Sessions non annulées qui occupent cette salle ou ce formateur pendant la période (bornes incluses). */
  findConflicts(input: { roomId: string; trainerId: string; start: IsoDate; end: IsoDate; excludeId?: string }): Promise<TrainingSession[]>;
  list(query: SessionListQuery): Promise<Page<TrainingSession>>;
}

export const SESSION_REPOSITORY = Symbol('SessionRepository');
