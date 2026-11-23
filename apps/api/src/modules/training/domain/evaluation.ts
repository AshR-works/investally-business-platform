import { AggregateRoot, DomainError } from '../../../shared-kernel';

/**
 * Évaluation d'un inscrit confirmé (S5.3b, lot b de S5.3). Une **note sur 20**, sans commentaire libre (S4 de l'arbitrage), par inscription :
 * au plus une évaluation par inscrit. Saisie par le responsable Investudy, jamais par le formateur (externe, sans accès à l'application,
 * même règle que les présences, S1/ADR-0016). Figée dès que la session est clôturée (il faut la rouvrir, S7).
 */
export const MIN_SCORE = 0;
export const MAX_SCORE = 20;

/** Note sur 20, deux décimales au plus. */
export function parseScore(raw: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < MIN_SCORE || raw > MAX_SCORE || Math.round(raw * 100) !== raw * 100) {
    throw new DomainError('VALIDATION', `La note doit être un nombre entre ${MIN_SCORE} et ${MAX_SCORE}, avec deux décimales au plus`);
  }
  return raw;
}

export interface EvaluationProps {
  id: string;
  enrollmentId: string;
  score: number;
  recordedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Evaluation extends AggregateRoot {
  private constructor(private props: EvaluationProps) {
    super();
  }

  static record(input: { id: string; enrollmentId: string; score: number; recordedByUserId: string; now: Date }): Evaluation {
    return new Evaluation({
      id: input.id, enrollmentId: input.enrollmentId, score: parseScore(input.score), recordedByUserId: input.recordedByUserId,
      createdAt: input.now, updatedAt: input.now, version: 1,
    });
  }

  static rehydrate(props: EvaluationProps): Evaluation {
    return new Evaluation(props);
  }

  /** Corrige la note ; l'auteur de la dernière saisie est conservé (pas l'auteur d'origine). */
  change(input: { score: number; by: string; now: Date }): void {
    this.props = { ...this.props, score: parseScore(input.score), recordedByUserId: input.by, updatedAt: input.now };
  }

  get id(): string { return this.props.id; }
  get enrollmentId(): string { return this.props.enrollmentId; }
  get score(): number { return this.props.score; }
  get recordedByUserId(): string { return this.props.recordedByUserId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }
}

/** Suggestion calculée (S6, lot c) : ce lot (b) se limite au **calcul**, jamais à la délivrance. */
export type EligibilitySuggestion = 'CERTIFICATE' | 'ATTESTATION' | 'NONE';

export interface TrainingThresholds {
  /** Taux de présence minimal (0-100) pour un certificat ou une attestation. */
  attendanceThresholdPercent: number;
  /** Note minimale (sur 20) pour un certificat, en plus du taux de présence. */
  scoreThreshold: number;
  version: number;
}

export const DEFAULT_TRAINING_THRESHOLDS: TrainingThresholds = { attendanceThresholdPercent: 80, scoreThreshold: 10, version: 1 };

/** Règles de départ « à confirmer » (D31, S5) : taux de présence entre 0 et 100 ; note entre 0 et 20. */
export function validateTrainingThresholds(input: { attendanceThresholdPercent: number; scoreThreshold: number }): void {
  const { attendanceThresholdPercent, scoreThreshold } = input;
  if (typeof attendanceThresholdPercent !== 'number' || !Number.isFinite(attendanceThresholdPercent) || attendanceThresholdPercent < 0 || attendanceThresholdPercent > 100) {
    throw new DomainError('VALIDATION', 'Le taux de présence minimal doit être un pourcentage entre 0 et 100');
  }
  parseScore(scoreThreshold);
}

/**
 * Calcule la suggestion d'éligibilité (CU-I-60) : **certificat** si le taux de présence et la note atteignent les deux seuils ;
 * **attestation** si seul le taux de présence est atteint (aucune note saisie n'empêche l'attestation) ; sinon aucune suggestion.
 * Un calcul, jamais une délivrance (S6 : suggérée puis délivrée à la main, lot c).
 */
export function computeEligibility(input: { attendanceRatePercent: number; score: number | null; thresholds: TrainingThresholds }): EligibilitySuggestion {
  const { attendanceRatePercent, score, thresholds } = input;
  const attendanceOk = attendanceRatePercent >= thresholds.attendanceThresholdPercent;
  if (!attendanceOk) return 'NONE';
  if (score !== null && score >= thresholds.scoreThreshold) return 'CERTIFICATE';
  return 'ATTESTATION';
}
