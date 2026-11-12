import { Page } from '../../src/shared-kernel';
import { IsoDate, overlaps } from '../../src/modules/training/domain/session-dates';
import { SessionListQuery, SessionRepository } from '../../src/modules/training/domain/session-repositories';
import { TrainingSession } from '../../src/modules/training/domain/training-session';
import { InMemoryTrainers } from './in-memory-catalogue';

/** Dépôt en mémoire des sessions, pour les tests unitaires (les versions ne sont pas incrémentées : c'est le travail de la base). */
export class InMemorySessions implements SessionRepository {
  readonly items: TrainingSession[] = [];
  /** Nombre d'appels à `lockResources` (le contrôle de chevauchement doit toujours être précédé du verrou). */
  locks = 0;

  constructor(private readonly trainers: InMemoryTrainers) {}

  async save(session: TrainingSession) { if (!this.items.includes(session)) this.items.push(session); }
  async findById(id: string) { return this.items.find((s) => s.id === id) ?? null; }
  async lockResources() { this.locks += 1; }

  async findConflicts(input: { roomId: string; trainerId: string; start: IsoDate; end: IsoDate; excludeId?: string }) {
    return this.items.filter(
      (s) => s.status !== 'CANCELLED' && s.id !== input.excludeId && (s.roomId === input.roomId || s.trainerId === input.trainerId) && overlaps(s.startDate, s.endDate, input.start, input.end),
    );
  }

  async list(query: SessionListQuery): Promise<Page<TrainingSession>> {
    const rows = this.items
      .filter((s) => !query.status || s.status === query.status)
      .filter((s) => !query.roomId || s.roomId === query.roomId)
      .filter((s) => !query.trainerId || s.trainerId === query.trainerId)
      .filter((s) => !query.trainingId || s.trainingId === query.trainingId)
      .filter((s) => !query.from || s.endDate >= query.from)
      .filter((s) => !query.to || s.startDate <= query.to)
      .filter((s) => {
        if (!query.visibleToUserIds) return true;
        const trainer = this.trainers.items.find((t) => t.id === s.trainerId);
        return Boolean(trainer?.userId && query.visibleToUserIds.includes(trainer.userId));
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    return { items: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize };
  }
}
