import { Page } from '../../../shared-kernel';
import { Consumption } from './approval-cover';
import { Enrollment, EnrollmentStatus } from './enrollment';
import { IsoDate } from './session-dates';
import { Learner } from './learner';

export interface LearnerListQuery {
  page: number;
  pageSize: number;
  search?: string;
  companyId?: string;
  /** Restreint aux apprenants de ces entreprises (la portée de l'utilisateur, résolue par l'annuaire du module commercial ; liste vide = aucun) ; absent = pas de restriction. */
  companyIds?: readonly string[];
}

export interface LearnerRepository {
  save(learner: Learner): Promise<void>;
  /** Un apprenant supprimé logiquement n'est jamais renvoyé. */
  findById(id: string): Promise<Learner | null>;
  /** Doublon probable : même entreprise et même nom ou même e-mail. */
  findDuplicates(input: { companyId: string; nameKey: string; emailKey: string | null; excludeId?: string }): Promise<Learner[]>;
  list(query: LearnerListQuery): Promise<Page<Learner>>;
  /** Noms complets (supprimés compris) : une inscription garde le nom de son apprenant même après la suppression logique de celui-ci. */
  namesOf(ids: readonly string[]): Promise<Map<string, string>>;
}

export interface EnrollmentListQuery {
  page: number;
  pageSize: number;
  sessionId?: string;
  learnerId?: string;
  companyId?: string;
  status?: EnrollmentStatus;
  /** Restreint aux inscriptions de ces entreprises (liste vide = aucune) ; absent = pas de restriction. */
  companyIds?: readonly string[];
}

export interface EnrollmentRepository {
  save(enrollment: Enrollment): Promise<void>;
  findById(id: string): Promise<Enrollment | null>;
  /** Verrouille la session jusqu'à la fin de la transaction : deux inscriptions simultanées ne peuvent pas prendre la même dernière place. */
  lockSession(sessionId: string): Promise<void>;
  /** Places occupées (inscriptions en attente ou confirmées). */
  countSeats(sessionId: string): Promise<number>;
  /** Places occupées par session, pour l'affichage de plusieurs sessions à la fois. */
  countSeatsBySession(sessionIds: readonly string[]): Promise<Map<string, number>>;
  /** Ce que les inscriptions en attente ou confirmées ont consommé de cet agrément. */
  consumptionOf(approvalId: string): Promise<Consumption>;
  /** L'apprenant a-t-il déjà une inscription vivante (en attente, confirmée ou à replacer) à cette session ? */
  hasLive(sessionId: string, learnerId: string): Promise<boolean>;
  /** Inscription en attente ou confirmée de l'apprenant sur une autre session non annulée qui recouvre la période. */
  findOverlap(input: { learnerId: string; start: IsoDate; end: IsoDate; excludeEnrollmentId?: string; excludeSessionId?: string }): Promise<{ enrollment: Enrollment; sessionStart: IsoDate; sessionEnd: IsoDate } | null>;
  /** Apprenants des inscriptions en attente ou confirmées d'une session (pour contrôler un report). */
  seatLearnerIds(sessionId: string): Promise<string[]>;
  /** Inscriptions en attente ou confirmées de la session (annulation de la session). */
  listSeats(sessionId: string): Promise<Enrollment[]>;
  /** L'apprenant a-t-il une inscription confirmée ? (suppression logique) */
  hasConfirmed(learnerId: string): Promise<boolean>;
  list(query: EnrollmentListQuery): Promise<Page<Enrollment>>;
}

export const LEARNER_REPOSITORY = Symbol('LearnerRepository');
export const ENROLLMENT_REPOSITORY = Symbol('EnrollmentRepository');
