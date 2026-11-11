import { Appointment, AppointmentStatus, AppointmentType } from './appointment';

const now = new Date('2026-11-04T10:00:00Z');
const make = (extra: Record<string, unknown> = {}) =>
  Appointment.plan({ id: 'a1', type: 'FINANCE_DIRECTOR', companyId: 'c1', organizerUserId: 'u1', startsAt: '2026-11-10T09:00:00Z', location: '  Siège  ', note: ' Présenter l’offre ', now, ...extra });

describe('Rendez-vous — planification', () => {
  it('est « à venir » dès la planification ; durée de 60 minutes par défaut, textes nettoyés, version 1', () => {
    expect(make()).toMatchObject({
      status: AppointmentStatus.Planned, type: AppointmentType.FinanceDirector, durationMinutes: 60, location: 'Siège', note: 'Présenter l’offre',
      outcomeNote: null, closedAt: null, postponements: 0, contactId: null, offerId: null, version: 1,
    });
    expect(make().endsAt.toISOString()).toBe('2026-11-10T10:00:00.000Z');
  });
  it('accepte les trois types et les durées limites', () => {
    for (const type of ['FINANCE_DIRECTOR', 'DECISION_MAKER', 'VISIT']) expect(make({ type }).type).toBe(type);
    expect(make({ durationMinutes: 15 }).durationMinutes).toBe(15);
    expect(make({ durationMinutes: 480 }).durationMinutes).toBe(480);
    expect(make({ location: '   ', note: undefined }).location).toBeNull();
  });
  it.each([
    [{ type: 'GOUTER' }], [{ type: '' }], [{ startsAt: 'demain' }], [{ startsAt: '2026-11-04T10:00:00Z' }], [{ startsAt: '2026-11-03T09:00:00Z' }],
    [{ durationMinutes: 14 }], [{ durationMinutes: 481 }], [{ durationMinutes: 30.5 }], [{ location: 'x'.repeat(201) }], [{ note: 'x'.repeat(501) }],
    [{ companyId: '' }], [{ organizerUserId: '' }],
  ] as [Record<string, unknown>][])('refuse %j', (patch) => {
    expect(() => make(patch)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
});

describe('Rendez-vous — modification', () => {
  it('modifie durée, lieu, note et contact ; tout ou rien en cas de refus', () => {
    const a = make();
    a.edit({ durationMinutes: 90, location: 'Visioconférence', note: null, contactId: 'k1' });
    expect(a).toMatchObject({ durationMinutes: 90, location: 'Visioconférence', note: null, contactId: 'k1' });
    expect(() => a.edit({ location: 'Autre', durationMinutes: 5 })).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(a.location).toBe('Visioconférence');
  });
  it('un rendez-vous clos ne se modifie plus', () => {
    const a = make({ startsAt: '2026-11-05T09:00:00Z' });
    a.cancel('Client indisponible', now);
    expect(() => a.edit({ note: 'Trop tard' })).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
});

describe('Rendez-vous — report', () => {
  it('change l’heure, garde « à venir », compte le report et garde le motif', () => {
    const a = make();
    a.postpone('2026-11-12T09:00:00Z', ' Agenda du DAF chargé ', now);
    expect(a).toMatchObject({ status: AppointmentStatus.Planned, postponements: 1, lastPostponeReason: 'Agenda du DAF chargé' });
    expect(a.startsAt.toISOString()).toBe('2026-11-12T09:00:00.000Z');
    a.postpone('2026-11-13T09:00:00Z', 'Encore décalé', now);
    expect(a.postponements).toBe(2);
  });
  it.each([
    ['2026-11-12T09:00:00Z', ''], ['2026-11-12T09:00:00Z', 'ab'], ['2026-11-12T09:00:00Z', 'x'.repeat(501)],
    ['2026-11-03T09:00:00Z', 'Motif valable'], ['n’importe quoi', 'Motif valable'], ['2026-11-10T09:00:00Z', 'Même heure'],
  ])('refuse le report à %s avec le motif « %s »', (startsAt, reason) => {
    const a = make();
    expect(() => a.postpone(startsAt, reason, now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(a.postponements).toBe(0);
    expect(a.startsAt.toISOString()).toBe('2026-11-10T09:00:00.000Z');
  });
  it('un rendez-vous clos ne se reporte plus', () => {
    const a = make();
    a.cancel('Annulé par le client', now);
    expect(() => a.postpone('2026-11-12T09:00:00Z', 'Motif valable', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
});

describe('Rendez-vous — tenu et annulé', () => {
  const later = new Date('2026-11-10T11:00:00Z');
  it('tenu : compte rendu obligatoire, une fois l’heure venue, définitif', () => {
    const a = make();
    expect(() => a.hold('Compte rendu', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('avant son heure de début') }));
    expect(() => a.hold('  ', later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => a.hold('x'.repeat(1001), later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    a.hold('  Le DAF veut une remise  ', later);
    expect(a).toMatchObject({ status: AppointmentStatus.Held, outcomeNote: 'Le DAF veut une remise', closedAt: later });
    expect(() => a.hold('Encore', later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(() => a.cancel('Trop tard', later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
  it('tenu à l’heure pile de début', () => {
    const a = make();
    a.hold('Compte rendu', new Date('2026-11-10T09:00:00Z'));
    expect(a.status).toBe(AppointmentStatus.Held);
  });
  it('annulé : motif obligatoire, possible à tout moment, définitif', () => {
    const a = make();
    expect(() => a.cancel('', now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => a.cancel('x'.repeat(501), now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    a.cancel('Client indisponible', now);
    expect(a).toMatchObject({ status: AppointmentStatus.Cancelled, outcomeNote: 'Client indisponible', closedAt: now });
    expect(() => a.cancel('Encore', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(() => a.hold('Compte rendu', later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
});

describe('Rendez-vous — chevauchement et compte rendu attendu', () => {
  it('deux créneaux se chevauchent s’ils se recouvrent ; bout à bout, non', () => {
    const a = make(); // 09:00 - 10:00
    const slot = (start: string, end: string) => ({ startsAt: new Date(start), endsAt: new Date(end) });
    expect(a.overlaps(slot('2026-11-10T09:30:00Z', '2026-11-10T10:30:00Z'))).toBe(true);
    expect(a.overlaps(slot('2026-11-10T08:30:00Z', '2026-11-10T09:30:00Z'))).toBe(true);
    expect(a.overlaps(slot('2026-11-10T09:15:00Z', '2026-11-10T09:45:00Z'))).toBe(true);
    expect(a.overlaps(slot('2026-11-10T08:00:00Z', '2026-11-10T11:00:00Z'))).toBe(true);
    expect(a.overlaps(slot('2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z'))).toBe(false);
    expect(a.overlaps(slot('2026-11-10T08:00:00Z', '2026-11-10T09:00:00Z'))).toBe(false);
  });
  it('compte rendu attendu : à venir et heure passée seulement', () => {
    const a = make();
    expect(a.isReportDue(new Date('2026-11-10T08:59:00Z'))).toBe(false);
    expect(a.isReportDue(new Date('2026-11-10T09:00:00Z'))).toBe(true);
    a.hold('Compte rendu', new Date('2026-11-10T09:30:00Z'));
    expect(a.isReportDue(new Date('2026-11-11T09:00:00Z'))).toBe(false);
  });
});
