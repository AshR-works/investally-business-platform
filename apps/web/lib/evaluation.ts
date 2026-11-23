/** Évaluations et seuils d'éligibilité (S5.3b) : une note sur 20 par inscrit confirmé, sans commentaire libre ; une suggestion calculée, jamais délivrée ici (lot c). */

export const EVALUATION_PERMISSIONS = {
  read: 'training.evaluation.read', record: 'training.evaluation.record', manage: 'training.evaluation.manage',
} as const;

export type EligibilitySuggestion = 'CERTIFICATE' | 'ATTESTATION' | 'NONE';

export const SUGGESTION_LABEL: Record<EligibilitySuggestion, string> = {
  CERTIFICATE: 'Certificat', ATTESTATION: 'Attestation', NONE: 'Aucune suggestion',
};

export interface EvaluationSheetRow {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  score: number | null;
  attendanceRatePercent: number;
  suggestion: EligibilitySuggestion;
}

export interface EvaluationSheet {
  sessionId: string;
  sessionStatus: string;
  rows: EvaluationSheetRow[];
  /** La session n'est pas clôturée : la saisie reste possible (sinon figée, il faut la rouvrir). */
  canRecord: boolean;
}

export interface TrainingThresholds {
  attendanceThresholdPercent: number;
  scoreThreshold: number;
  version: number;
}

/** Note saisie : texte en entrée, nombre validé en sortie (0-20, deux décimales au plus). `null` si vide ou invalide. */
export function parseScoreInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 20) return null;
  return value;
}

export const scoreText = (score: number | null): string => (score === null ? 'non saisie' : `${score}/20`);
