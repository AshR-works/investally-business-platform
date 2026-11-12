import { RoomKind } from '../domain/room';
import { IsoDate } from '../domain/session-dates';
import { rhythmOf, SessionStatus, TrainingSession } from '../domain/training-session';
import { totalHours } from '../domain/rhythms';

/** Où en est la session par rapport à aujourd'hui (déduit des dates, jamais saisi). */
export type SessionPhase = 'UPCOMING' | 'IN_PROGRESS' | 'ENDED';

export interface SessionView {
  id: string;
  trainingId: string;
  trainingTitle: string;
  programName: string;
  rhythm: { code: string; label: string; weeks: number; totalHours: number };
  startDate: IsoDate;
  endDate: IsoDate;
  roomId: string;
  roomName: string;
  roomKind: RoomKind;
  /** Places utiles de la salle aujourd'hui (la capacité de la session ne peut pas la dépasser à la planification). */
  roomUsableSeats: number;
  trainerId: string;
  trainerName: string;
  capacity: number;
  /** Places occupées : inscriptions en attente ou confirmées. */
  enrolled: number;
  status: SessionStatus;
  phase: SessionPhase;
  cancelReason: string | null;
  /** Le certificat contient au moins un module pratique sur poste de travail. */
  needsWorkstations: boolean;
  version: number;
  createdAt: string;
}

export interface SessionContext {
  trainingTitle: string;
  programName: string;
  roomName: string;
  roomKind: RoomKind;
  roomUsableSeats: number;
  trainerName: string;
  needsWorkstations: boolean;
  enrolled: number;
}

export function phaseOf(session: Pick<TrainingSession, 'startDate' | 'endDate'>, today: IsoDate): SessionPhase {
  if (today < session.startDate) return 'UPCOMING';
  return today <= session.endDate ? 'IN_PROGRESS' : 'ENDED';
}

export function toSessionView(session: TrainingSession, context: SessionContext, today: IsoDate): SessionView {
  const rhythm = rhythmOf(session.rhythm);
  return {
    id: session.id,
    trainingId: session.trainingId,
    trainingTitle: context.trainingTitle,
    programName: context.programName,
    rhythm: { code: rhythm.code, label: rhythm.label, weeks: rhythm.weeks, totalHours: totalHours(rhythm) },
    startDate: session.startDate,
    endDate: session.endDate,
    roomId: session.roomId,
    roomName: context.roomName,
    roomKind: context.roomKind,
    roomUsableSeats: context.roomUsableSeats,
    trainerId: session.trainerId,
    trainerName: context.trainerName,
    capacity: session.capacity,
    enrolled: context.enrolled,
    status: session.status,
    phase: phaseOf(session, today),
    cancelReason: session.cancelReason,
    needsWorkstations: context.needsWorkstations,
    version: session.version,
    createdAt: session.createdAt.toISOString(),
  };
}
