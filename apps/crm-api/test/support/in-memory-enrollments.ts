import { Page } from '../../src/shared-kernel';
import { ApprovalRef, CompanyDirectory, CompanyRef } from '../../src/modules/business-development';
import { Consumption } from '../../src/modules/training/domain/approval-cover';
import { Enrollment, SEAT_STATUSES } from '../../src/modules/training/domain/enrollment';
import { EnrollmentListQuery, EnrollmentRepository, LearnerListQuery, LearnerRepository } from '../../src/modules/training/domain/enrollment-repositories';
import { Learner } from '../../src/modules/training/domain/learner';
import { toCents } from '../../src/modules/training/domain/money';
import { IsoDate, overlaps } from '../../src/modules/training/domain/session-dates';
import { InMemorySessions } from './in-memory-sessions';

const pageOf = <T>(items: T[], query: { page: number; pageSize: number }): Page<T> => ({
  items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize,
});

/** Annuaire en mémoire du module commercial : entreprises, contacts et agréments déclarés par le test. */
export class InMemoryDirectory implements CompanyDirectory {
  readonly companies = new Map<string, CompanyRef>();
  readonly contacts = new Map<string, string>(); // contact -> entreprise
  readonly approvals = new Map<string, ApprovalRef>();
  locks = 0;

  async company(id: string) { return this.companies.get(id) ?? null; }
  async companyIdsOwnedBy(ownerIds: readonly string[]) { return [...this.companies.values()].filter((c) => ownerIds.includes(c.ownerUserId ?? '')).map((c) => c.id); }
  async contactBelongsTo(contactId: string, companyId: string) { return this.contacts.get(contactId) === companyId; }
  async approval(id: string) { return this.approvals.get(id) ?? null; }
  async approvalsOf(companyId: string) { return [...this.approvals.values()].filter((a) => a.companyId === companyId); }
  async lockApproval() { this.locks += 1; }
}

/** Dépôt en mémoire des apprenants (les versions ne sont pas incrémentées : c'est le travail de la base). */
export class InMemoryLearners implements LearnerRepository {
  readonly items: Learner[] = [];

  constructor(private readonly directory: InMemoryDirectory) {}

  async save(learner: Learner) { if (!this.items.includes(learner)) this.items.push(learner); }
  async findById(id: string) { return this.items.find((l) => l.id === id && !l.deleted) ?? null; }
  async findDuplicates(input: { companyId: string | null; nameKey: string; emailKey: string | null; excludeId?: string }) {
    return this.items.filter(
      (l) => !l.deleted && l.companyId === input.companyId && (input.companyId !== null || l.isIndividual) && l.id !== input.excludeId && (l.nameKey === input.nameKey || (input.emailKey !== null && l.emailKey === input.emailKey)),
    );
  }
  async list(query: LearnerListQuery) {
    const rows = this.items
      .filter((l) => !l.deleted)
      .filter((l) => !query.companyId || l.companyId === query.companyId)
      .filter((l) => !query.kind || l.kind === query.kind)
      .filter((l) => !query.companyIds || (l.companyId !== null && query.companyIds.includes(l.companyId)))
      .filter((l) => !query.search || l.fullName.toLowerCase().includes(query.search.toLowerCase()));
    return pageOf(rows, query);
  }
  async namesOf(ids: readonly string[]) { return new Map(this.items.filter((l) => ids.includes(l.id)).map((l) => [l.id, l.fullName])); }
  async kindsOf(ids: readonly string[]) { return new Map(this.items.filter((l) => ids.includes(l.id)).map((l) => [l.id, l.kind] as const)); }
}

/** Dépôt en mémoire des inscriptions. */
export class InMemoryEnrollments implements EnrollmentRepository {
  readonly items: Enrollment[] = [];
  locks = 0;

  constructor(private readonly sessions: InMemorySessions, private readonly directory: InMemoryDirectory) {}

  async save(enrollment: Enrollment) { if (!this.items.includes(enrollment)) this.items.push(enrollment); }
  async findById(id: string) { return this.items.find((e) => e.id === id) ?? null; }
  async lockSession() { this.locks += 1; }
  async countSeats(sessionId: string) { return this.items.filter((e) => e.sessionId === sessionId && e.occupiesSeat).length; }
  async countSeatsBySession(sessionIds: readonly string[]) {
    return new Map(sessionIds.map((id) => [id, this.items.filter((e) => e.sessionId === id && e.occupiesSeat).length] as const).filter(([, n]) => n > 0));
  }
  async consumptionOf(approvalId: string): Promise<Consumption> {
    const rows = this.items.filter((e) => e.approvalId === approvalId && e.occupiesSeat);
    return { places: rows.length, cents: rows.reduce((sum, e) => sum + (e.chargedAmount === null ? 0 : toCents(e.chargedAmount)), 0) };
  }
  async hasLive(sessionId: string, learnerId: string) { return this.items.some((e) => e.sessionId === sessionId && e.learnerId === learnerId && e.status !== 'CANCELLED'); }
  async findOverlap(input: { learnerId: string; start: IsoDate; end: IsoDate; excludeEnrollmentId?: string; excludeSessionId?: string }) {
    for (const e of this.items) {
      if (e.learnerId !== input.learnerId || !SEAT_STATUSES.includes(e.status) || e.id === input.excludeEnrollmentId || e.sessionId === input.excludeSessionId) continue;
      const session = await this.sessions.findById(e.sessionId);
      if (session && session.status !== 'CANCELLED' && overlaps(session.startDate, session.endDate, input.start, input.end)) {
        return { enrollment: e, sessionStart: session.startDate, sessionEnd: session.endDate };
      }
    }
    return null;
  }
  async seatLearnerIds(sessionId: string) { return this.items.filter((e) => e.sessionId === sessionId && e.occupiesSeat).map((e) => e.learnerId); }
  async listSeats(sessionId: string) { return this.items.filter((e) => e.sessionId === sessionId && e.occupiesSeat); }
  async hasConfirmed(learnerId: string) { return this.items.some((e) => e.learnerId === learnerId && e.status === 'CONFIRMED'); }
  async list(query: EnrollmentListQuery) {
    const rows = this.items
      .filter((e) => !query.sessionId || e.sessionId === query.sessionId)
      .filter((e) => !query.learnerId || e.learnerId === query.learnerId)
      .filter((e) => !query.companyId || e.companyId === query.companyId)
      .filter((e) => !query.status || e.status === query.status)
      .filter((e) => !query.companyIds || (e.companyId !== null && query.companyIds.includes(e.companyId)));
    return pageOf(rows, query);
  }
}
