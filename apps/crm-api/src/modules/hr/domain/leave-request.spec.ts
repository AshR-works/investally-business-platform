import { LeaveRequest, LeaveStatus } from './leave-request';

const EMP = '00000000-0000-4000-8000-000000000001';
const TYPE = '00000000-0000-4000-8000-0000000000a1';
const now = new Date('2026-11-10T09:00:00Z');
const later = new Date('2026-11-11T09:00:00Z');
const base = { id: 'r1', employeeId: EMP, leaveTypeId: TYPE, start: '2026-12-14', end: '2026-12-18', startHalf: false, endHalf: false, days: 5, requestedByUserId: 'u1', now };
const make = (extra: Record<string, unknown> = {}) => LeaveRequest.create({ ...base, ...extra } as Parameters<typeof LeaveRequest.create>[0]);

describe('demande d’absence — création', () => {
  it('commence en attente, version 1, sans décision ni annulation', () => {
    const r = make({ note: '  Voyage  ' });
    expect(r).toMatchObject({ status: LeaveStatus.Pending, version: 1, days: 5, note: 'Voyage', decidedByUserId: null, decidedAt: null, decisionNote: null, cancelledAt: null, cancelReason: null, year: 2026, isActive: true });
    expect(r.period).toEqual({ start: '2026-12-14', end: '2026-12-18', startHalf: false, endHalf: false });
    expect(r.createdAt).toBe(now);
  });

  it('peut naître validée (saisie par la RH, type sans validation)', () => {
    const r = make({ approvedBy: 'hr1' });
    expect(r).toMatchObject({ status: LeaveStatus.Approved, decidedByUserId: 'hr1', decidedAt: now });
    expect(make({ approvedBy: null }).status).toBe(LeaveStatus.Pending);
    expect(make({ approvedBy: undefined }).status).toBe(LeaveStatus.Pending);
  });

  it('l’année de congé est celle de la date de début', () => {
    expect(make({ start: '2026-12-30', end: '2027-01-05', days: 4 }).year).toBe(2026);
    expect(make({ start: '2027-01-04', end: '2027-01-05', days: 2 }).year).toBe(2027);
  });

  it('un motif vide devient absent, trop long est refusé', () => {
    expect(make({ note: '   ' }).note).toBeNull();
    expect(make({ note: undefined }).note).toBeNull();
    expect(() => make({ note: 'x'.repeat(501) })).toThrow(/500/);
    expect(make({ note: 'x'.repeat(500) }).note).toHaveLength(500);
  });

  it('refuse une période mal formée', () => {
    expect(() => make({ start: '2026-12-18', end: '2026-12-14' })).toThrow(/précéder/);
    expect(() => make({ start: '2026-14-18' })).toThrow(/début/);
  });

  it('refuse des identifiants qui ne sont pas des UUID', () => {
    expect(() => make({ employeeId: 'abc' })).toThrow(/identifiants/);
    expect(() => make({ leaveTypeId: 'abc' })).toThrow(/identifiants/);
  });

  it('refuse une durée nulle, négative, ou pas par demi-journée', () => {
    for (const days of [0, -1, 0.25, 1.3, Number.NaN]) expect(() => make({ days })).toThrow(/durée/);
    expect(make({ days: 0.5, start: '2026-12-14', end: '2026-12-14', endHalf: true }).days).toBe(0.5);
  });
});

describe('demande d’absence — décision', () => {
  it('valide une demande en attente', () => {
    const r = make();
    r.approve({ by: 'boss', now: later });
    expect(r).toMatchObject({ status: LeaveStatus.Approved, decidedByUserId: 'boss', decidedAt: later, isActive: true });
  });

  it('refuse avec un motif obligatoire, rogné', () => {
    const r = make();
    expect(() => r.reject({ by: 'boss', note: '   ', now: later })).toThrow(/motif du refus/);
    expect(() => r.reject({ by: 'boss', note: '', now: later })).toThrow(/obligatoire/);
    expect(r.status).toBe(LeaveStatus.Pending);
    r.reject({ by: 'boss', note: '  Période de clôture  ', now: later });
    expect(r).toMatchObject({ status: LeaveStatus.Rejected, decisionNote: 'Période de clôture', decidedByUserId: 'boss', isActive: false });
  });

  it('on ne décide qu’une fois : une demande décidée ne se valide ni ne se refuse plus', () => {
    const approved = make();
    approved.approve({ by: 'boss', now: later });
    expect(() => approved.approve({ by: 'boss', now: later })).toThrow(/en attente/);
    expect(() => approved.reject({ by: 'boss', note: 'non', now: later })).toThrow(/en attente/);
    const rejected = make();
    rejected.reject({ by: 'boss', note: 'non', now: later });
    expect(() => rejected.approve({ by: 'boss', now: later })).toThrow(/en attente/);
    expect(() => make({ approvedBy: 'hr1' }).approve({ by: 'x', now: later })).toThrow(/en attente/);
  });
});

describe('demande d’absence — annulation', () => {
  it('annule une demande en attente, motif facultatif', () => {
    const r = make();
    r.cancel({ now: later });
    expect(r).toMatchObject({ status: LeaveStatus.Cancelled, cancelledAt: later, cancelReason: null, isActive: false });
    const other = make();
    other.cancel({ reason: '  Plan changé  ', now: later });
    expect(other.cancelReason).toBe('Plan changé');
  });

  it('une demande validée ne s’annule qu’avec un motif', () => {
    const r = make({ approvedBy: 'hr1' });
    expect(() => r.cancel({ now: later })).toThrow(/obligatoire/);
    expect(() => r.cancel({ reason: '  ', now: later })).toThrow(/obligatoire/);
    expect(r.status).toBe(LeaveStatus.Approved);
    r.cancel({ reason: 'Voyage reporté', now: later });
    expect(r).toMatchObject({ status: LeaveStatus.Cancelled, cancelReason: 'Voyage reporté' });
  });

  it('une demande refusée ou déjà annulée ne change plus', () => {
    const rejected = make();
    rejected.reject({ by: 'b', note: 'non', now: later });
    expect(() => rejected.cancel({ reason: 'x', now: later })).toThrow(/terminée/);
    const cancelled = make();
    cancelled.cancel({ now: later });
    expect(() => cancelled.cancel({ now: later })).toThrow(/terminée/);
  });

  it('refuse un motif d’annulation trop long', () => {
    expect(() => make().cancel({ reason: 'x'.repeat(501), now: later })).toThrow(/500/);
  });
});

describe('demande d’absence — reconstitution', () => {
  it('rend ce qui a été persisté', () => {
    const r = make();
    const copy = LeaveRequest.rehydrate({
      id: r.id, employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, ...r.period, days: r.days, status: r.status, note: r.note, requestedByUserId: r.requestedByUserId,
      decidedByUserId: null, decidedAt: null, decisionNote: null, cancelledAt: null, cancelReason: null, createdAt: r.createdAt, version: 7,
    });
    expect(copy).toMatchObject({ id: 'r1', version: 7, status: LeaveStatus.Pending, requestedByUserId: 'u1' });
  });
});
