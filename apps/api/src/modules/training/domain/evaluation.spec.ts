import { DomainError } from '../../../shared-kernel';
import { computeEligibility, DEFAULT_TRAINING_THRESHOLDS, Evaluation, parseScore, validateTrainingThresholds } from './evaluation';

const NOW = new Date('2026-11-06T09:00:00.000Z');

const expectError = (fn: () => unknown, code: string, message: RegExp) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    expect((error as DomainError).message).toMatch(message);
    return;
  }
  throw new Error('une erreur de domaine était attendue');
};

describe('Note sur 20', () => {
  it('accepte entre 0 et 20, deux décimales au plus', () => {
    expect(parseScore(0)).toBe(0);
    expect(parseScore(20)).toBe(20);
    expect(parseScore(15.5)).toBe(15.5);
  });
  it('refuse hors bornes ou plus de deux décimales', () => {
    expectError(() => parseScore(-0.01), 'VALIDATION', /entre 0 et 20/);
    expectError(() => parseScore(20.01), 'VALIDATION', /entre 0 et 20/);
    expectError(() => parseScore(15.555), 'VALIDATION', /entre 0 et 20/);
  });
});

describe('Évaluation', () => {
  it('se saisit, version 1, puis se corrige en gardant le dernier auteur', () => {
    const e = Evaluation.record({ id: 'e1', enrollmentId: 'en1', score: 15.5, recordedByUserId: 'u1', now: NOW });
    expect(e).toMatchObject({ enrollmentId: 'en1', score: 15.5, recordedByUserId: 'u1', version: 1 });
    const later = new Date('2026-11-06T18:00:00Z');
    e.change({ score: 8, by: 'u2', now: later });
    expect(e).toMatchObject({ score: 8, recordedByUserId: 'u2', updatedAt: later });
  });

  it('refuse une note hors barème, à la saisie comme à la correction', () => {
    expectError(() => Evaluation.record({ id: 'e1', enrollmentId: 'en1', score: 21, recordedByUserId: 'u1', now: NOW }), 'VALIDATION', /entre 0 et 20/);
    const e = Evaluation.record({ id: 'e1', enrollmentId: 'en1', score: 10, recordedByUserId: 'u1', now: NOW });
    expectError(() => e.change({ score: -1, by: 'u1', now: NOW }), 'VALIDATION', /entre 0 et 20/);
  });
});

describe('Seuils d\'éligibilité', () => {
  it('valeurs de départ : 80 % de présence, 10 sur 20', () => {
    expect(DEFAULT_TRAINING_THRESHOLDS).toMatchObject({ attendanceThresholdPercent: 80, scoreThreshold: 10 });
  });
  it('refuse un taux de présence hors 0-100, ou une note hors barème', () => {
    expectError(() => validateTrainingThresholds({ attendanceThresholdPercent: -1, scoreThreshold: 10 }), 'VALIDATION', /pourcentage entre 0 et 100/);
    expectError(() => validateTrainingThresholds({ attendanceThresholdPercent: 101, scoreThreshold: 10 }), 'VALIDATION', /pourcentage entre 0 et 100/);
    expectError(() => validateTrainingThresholds({ attendanceThresholdPercent: 80, scoreThreshold: 21 }), 'VALIDATION', /entre 0 et 20/);
  });
});

describe('Calcul d\'éligibilité (CU-I-60)', () => {
  const thresholds = DEFAULT_TRAINING_THRESHOLDS; // 80 %, 10/20

  it('certificat : les deux seuils atteints', () => {
    expect(computeEligibility({ attendanceRatePercent: 80, score: 10, thresholds })).toBe('CERTIFICATE');
    expect(computeEligibility({ attendanceRatePercent: 100, score: 20, thresholds })).toBe('CERTIFICATE');
  });
  it('attestation : la présence atteinte, la note absente ou insuffisante', () => {
    expect(computeEligibility({ attendanceRatePercent: 80, score: null, thresholds })).toBe('ATTESTATION');
    expect(computeEligibility({ attendanceRatePercent: 90, score: 9.99, thresholds })).toBe('ATTESTATION');
  });
  it('aucune suggestion : la présence n\'est pas atteinte, même avec une bonne note', () => {
    expect(computeEligibility({ attendanceRatePercent: 79.99, score: 20, thresholds })).toBe('NONE');
    expect(computeEligibility({ attendanceRatePercent: 0, score: null, thresholds })).toBe('NONE');
  });
});
