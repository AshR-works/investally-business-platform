import { Clock } from '../shared-kernel';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
