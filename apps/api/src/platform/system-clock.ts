import { Clock } from '../shared-kernel';

/** Horloge réelle (remplacée par une horloge contrôlée dans les tests). */
export class SystemClock implements Clock {
  /** Heure courante. */
  now(): Date {
    return new Date();
  }
}
