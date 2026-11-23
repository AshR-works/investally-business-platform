import { Evaluation } from './evaluation';
import { TrainingThresholds } from './evaluation';

/** Port de persistance des évaluations (au plus une par inscription). */
export interface EvaluationRepository {
  /** Crée ou met à jour ; une seconde saisie pour la même inscription est un conflit : la base garantit l'unicité. */
  save(evaluation: Evaluation): Promise<void>;
  find(enrollmentId: string): Promise<Evaluation | null>;
  /** Toutes les évaluations saisies pour ces inscriptions (une session entière). */
  bySession(enrollmentIds: readonly string[]): Promise<Evaluation[]>;
}

export const EVALUATION_REPOSITORY = Symbol('EvaluationRepository');

/** Port de persistance des seuils d'éligibilité (une seule ligne, paramétrable). */
export interface TrainingThresholdsRepository {
  get(): Promise<TrainingThresholds>;
  save(thresholds: TrainingThresholds): Promise<void>;
}

export const TRAINING_THRESHOLDS_REPOSITORY = Symbol('TrainingThresholdsRepository');
