import { DEFAULT_TRAINING_THRESHOLDS, Evaluation, TrainingThresholds } from '../../src/modules/training/domain/evaluation';
import { EvaluationRepository, TrainingThresholdsRepository } from '../../src/modules/training/domain/evaluation-repositories';
import { DomainError } from '../../src/shared-kernel';

/** Évaluations en mémoire : au plus une par inscription. Les versions ne sont pas incrémentées (travail de la base). */
export class InMemoryEvaluations implements EvaluationRepository {
  readonly items: Evaluation[] = [];

  async save(evaluation: Evaluation) {
    if (this.items.includes(evaluation)) return;
    if (this.items.some((e) => e.enrollmentId === evaluation.enrollmentId)) throw new DomainError('CONFLICT', 'Une évaluation est déjà saisie pour cette inscription : rechargez la page');
    this.items.push(evaluation);
  }
  async find(enrollmentId: string) { return this.items.find((e) => e.enrollmentId === enrollmentId) ?? null; }
  async bySession(enrollmentIds: readonly string[]) { return this.items.filter((e) => enrollmentIds.includes(e.enrollmentId)); }
}

/** Seuils d'éligibilité en mémoire : une seule ligne, avec verrou optimiste (comme la base). */
export class InMemoryTrainingThresholds implements TrainingThresholdsRepository {
  private row: TrainingThresholds = { ...DEFAULT_TRAINING_THRESHOLDS };

  async get() { return this.row; }
  async save(thresholds: TrainingThresholds) {
    if (thresholds.version !== this.row.version) throw new DomainError('CONFLICT', "Les seuils d'éligibilité ont été modifiés par un autre utilisateur : rechargez-les");
    this.row = { ...thresholds, version: this.row.version + 1 };
  }
}
