import { EligibilitySuggestion, Evaluation, TrainingThresholds } from '../domain/evaluation';

// Pas de verrou optimiste sur l'évaluation (même principe que la présence, ADR-0016) : la dernière saisie gagne, l'audit garde
// l'historique ; `version` existe en base (travail interne de la persistance) mais n'est délibérément pas exposée ici.
export interface EvaluationView {
  id: string;
  enrollmentId: string;
  score: number;
  recordedByUserId: string;
}

export const toEvaluationView = (evaluation: Evaluation): EvaluationView => ({
  id: evaluation.id, enrollmentId: evaluation.enrollmentId, score: evaluation.score, recordedByUserId: evaluation.recordedByUserId,
});

/** Une ligne par inscrit confirmé : sa note (absente si pas encore saisie), son taux de présence, et la suggestion calculée (S6 : jamais délivrée ici). */
export interface EvaluationSheetRow {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  score: number | null;
  attendanceRatePercent: number;
  suggestion: EligibilitySuggestion;
}

export interface EvaluationSheetView {
  sessionId: string;
  sessionStatus: string;
  rows: EvaluationSheetRow[];
  /** La session n'est pas clôturée : la saisie reste possible (sinon figée, S7). */
  canRecord: boolean;
}

/** Les seuils n'ont pas de verrou caché : `version` est exposée ici, contrairement à l'évaluation, car ce sont des réglages (comme les congés), pas une saisie répétée. */
export interface TrainingThresholdsView {
  attendanceThresholdPercent: number;
  scoreThreshold: number;
  version: number;
}

export const toTrainingThresholdsView = (thresholds: TrainingThresholds): TrainingThresholdsView => ({ ...thresholds });
