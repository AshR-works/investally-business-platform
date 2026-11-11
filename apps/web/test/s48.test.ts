import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL du rendez-vous valide les mêmes saisies.
import { Appointment } from '../../api/src/modules/business-development/domain/appointment';
import {
  type AgendaRights, agendaParams, agendaTitle, agendaWindow, APPOINTMENT_ACTION_LABEL, APPOINTMENT_STATUS, APPOINTMENT_TYPES, appointmentActions, appointmentTypeLabel,
  type AppointmentForm, buildAppointmentBody, canPlan, dayHeading, EMPTY_APPOINTMENT_FORM, formFromAppointment, groupByDay, localDay, localTime, mondayOf, plannableTypes,
  shiftAnchor, startOfLocalDay, timeRange, toInstant, validateAppointmentFields,
} from '../lib/appointments';
import { availableActions } from '../lib/offers';
import { MODULES } from '../lib/modules';
import type { Appointment as AppointmentView } from '../lib/types';

const now = new Date('2026-11-04T10:00:00Z');
const form = (patch: Partial<AppointmentForm> = {}): AppointmentForm => ({
  type: 'FINANCE_DIRECTOR', companyId: 'c1', contactId: '', offerId: '', opportunityId: '', date: '2026-11-20', time: '09:00', durationMinutes: '60', location: 'Siège', note: 'Présenter l’offre', ...patch,
});
const serverAccepts = (f: AppointmentForm): boolean => {
  try {
    Appointment.plan({
      id: 'x', type: f.type, companyId: f.companyId, organizerUserId: 'u1', startsAt: toInstant(f.date, f.time) ?? 'illisible', durationMinutes: Number(f.durationMinutes),
      location: f.location, note: f.note, now,
    });
    return true;
  } catch {
    return false;
  }
};
const view = (patch: Partial<AppointmentView> = {}): AppointmentView => ({
  id: 'a1', type: 'FINANCE_DIRECTOR', companyId: 'c1', companyName: 'Atlas', contactId: 'k1', contactName: 'Marie Fotso', offerId: null, offerReference: null, opportunityId: null, opportunityTitle: null, organizerUserId: 'u1',
  startsAt: new Date(2026, 10, 20, 9, 0).toISOString(), endsAt: new Date(2026, 10, 20, 10, 0).toISOString(), durationMinutes: 60, location: 'Siège', note: 'Présenter', status: 'PLANNED',
  outcomeNote: null, closedAt: null, postponements: 0, lastPostponeReason: null, reportDue: false, createdAt: '2026-11-04T10:00:00Z', version: 2, ...patch,
});
const rights = (patch: Partial<AgendaRights> = {}): AgendaRights => ({ create: true, update: true, cancel: true, visitCreate: true, visitUpdate: true, ...patch });

describe('agenda : libellés et types', () => {
  it('nomme les trois types et les trois états', () => {
    expect(APPOINTMENT_TYPES.map((t) => t.value)).toEqual(['FINANCE_DIRECTOR', 'DECISION_MAKER', 'VISIT']);
    expect(appointmentTypeLabel('VISIT')).toBe('Visite chez Investally');
    expect(appointmentTypeLabel('INCONNU')).toBe('INCONNU');
    expect(Object.keys(APPOINTMENT_STATUS)).toEqual(['PLANNED', 'HELD', 'CANCELLED']);
    expect(APPOINTMENT_STATUS.HELD!.label).toBe('Tenu');
  });
  it('un type se planifie selon le droit « rendez-vous » ou « visite »', () => {
    expect(canPlan('FINANCE_DIRECTOR', rights({ create: false }))).toBe(false);
    expect(canPlan('VISIT', rights({ create: false }))).toBe(true);
    expect(canPlan('VISIT', rights({ visitCreate: false }))).toBe(false);
    expect(plannableTypes(rights({ visitCreate: false })).map((t) => t.value)).toEqual(['FINANCE_DIRECTOR', 'DECISION_MAKER']);
    expect(plannableTypes(rights({ create: false, visitCreate: false }))).toEqual([]);
  });
});

describe('agenda : date et heure locales', () => {
  it('convertit un jour et une heure locaux en instant et inversement, sans décalage', () => {
    const instant = toInstant('2026-11-20', '09:30')!;
    expect(localDay(instant)).toBe('2026-11-20');
    expect(localTime(instant)).toBe('09:30');
    expect(new Date(instant).getTime()).toBe(new Date(2026, 10, 20, 9, 30).getTime());
  });
  it.each([['2026-02-31', '09:00'], ['demain', '09:00'], ['2026-11-20', '25:00'], ['2026-11-20', '9h'], ['2026-11-20', ''], ['', '09:00'], ['2026-11-20', '12:60']])('refuse %s à %s', (date, time) => {
    expect(toInstant(date, time)).toBeNull();
  });
  it('affiche la plage horaire d’un rendez-vous', () => {
    expect(timeRange({ startsAt: new Date(2026, 10, 20, 9, 0).toISOString(), endsAt: new Date(2026, 10, 20, 10, 15).toISOString() })).toBe('09:00 – 10:15');
  });
  it('propose le lendemain à 9 h, 60 minutes, par défaut', () => {
    const f = EMPTY_APPOINTMENT_FORM({}, new Date(2026, 10, 4, 15, 0));
    expect(f).toMatchObject({ type: 'FINANCE_DIRECTOR', date: '2026-11-05', time: '09:00', durationMinutes: '60', companyId: '', contactId: '', offerId: '' });
    expect(EMPTY_APPOINTMENT_FORM({ companyId: 'c9', type: 'VISIT' }, new Date(2026, 10, 4)).companyId).toBe('c9');
  });
  it('reconstitue le formulaire d’un rendez-vous existant', () => {
    expect(formFromAppointment(view())).toEqual({ type: 'FINANCE_DIRECTOR', companyId: 'c1', contactId: 'k1', offerId: '', opportunityId: '', date: '2026-11-20', time: '09:00', durationMinutes: '60', location: 'Siège', note: 'Présenter' });
  });
});

describe('agenda : contrôles de saisie', () => {
  const ctx = { now, editing: false };
  it('accepte une saisie complète', () => {
    expect(validateAppointmentFields(form(), ctx)).toEqual({});
  });
  it.each([
    [{ type: 'GOUTER' }, 'type'], [{ companyId: '' }, 'companyId'], [{ date: '' }, 'date'], [{ date: '2026-02-31' }, 'date'], [{ time: '' }, 'time'], [{ time: '27:00' }, 'time'],
    [{ date: '2026-11-03' }, 'time'], [{ durationMinutes: '' }, 'durationMinutes'], [{ durationMinutes: '14' }, 'durationMinutes'], [{ durationMinutes: '481' }, 'durationMinutes'],
    [{ durationMinutes: '30,5' }, 'durationMinutes'], [{ location: 'x'.repeat(201) }, 'location'], [{ note: 'x'.repeat(501) }, 'note'],
  ] as [Partial<AppointmentForm>, string][])('signale %j sur le champ %s', (patch, field) => {
    expect(Object.keys(validateAppointmentFields(form(patch), ctx))).toContain(field);
  });
  it('à la modification, ni date ni heure ni entreprise ne sont contrôlées', () => {
    expect(validateAppointmentFields(form({ companyId: '', date: '', time: '', type: 'VISIT' }), { now, editing: true })).toEqual({});
    expect(Object.keys(validateAppointmentFields(form({ durationMinutes: '5' }), { now, editing: true }))).toEqual(['durationMinutes']);
  });
  it('bornes de durée : 15 et 480 acceptées', () => {
    expect(validateAppointmentFields(form({ durationMinutes: '15' }), ctx)).toEqual({});
    expect(validateAppointmentFields(form({ durationMinutes: '480' }), ctx)).toEqual({});
  });
  it('le serveur réel accepte et refuse les mêmes saisies', () => {
    const cases: Partial<AppointmentForm>[] = [
      {}, { type: 'VISIT' }, { type: 'DECISION_MAKER', durationMinutes: '15' }, { durationMinutes: '480' }, { location: '', note: '' },
      { type: 'GOUTER' }, { companyId: '' }, { date: '2026-11-03' }, { date: '2026-02-31' }, { time: '27:00' }, { durationMinutes: '14' },
      { durationMinutes: '481' }, { durationMinutes: '45,5' }, { location: 'x'.repeat(201) }, { note: 'x'.repeat(501) },
    ];
    for (const patch of cases) {
      const f = form(patch);
      const clientOk = Object.keys(validateAppointmentFields(f, { now, editing: false })).length === 0;
      expect([JSON.stringify(patch), clientOk]).toEqual([JSON.stringify(patch), serverAccepts(f)]);
    }
  });
});

describe('agenda : corps des requêtes', () => {
  it('planification : type, entreprise, heure, durée ; contact, offre, lieu, note seulement s’ils existent', () => {
    const body = buildAppointmentBody(form({ contactId: 'k1', offerId: 'o1', location: ' Siège ', note: ' Note ' }));
    expect(body).toEqual({ type: 'FINANCE_DIRECTOR', companyId: 'c1', startsAt: toInstant('2026-11-20', '09:00'), durationMinutes: 60, contactId: 'k1', offerId: 'o1', location: 'Siège', note: 'Note' });
    const minimal = buildAppointmentBody(form({ location: '  ', note: '' }));
    expect(minimal).toEqual({ type: 'FINANCE_DIRECTOR', companyId: 'c1', startsAt: toInstant('2026-11-20', '09:00'), durationMinutes: 60 });
  });
  it('modification : la version lue, jamais le type, l’entreprise ni l’heure ; contact retiré = null', () => {
    const body = buildAppointmentBody(form({ contactId: '' }), { version: 4 });
    expect(body).toEqual({ version: 4, durationMinutes: 60, location: 'Siège', note: 'Présenter l’offre', contactId: null });
    expect(body).not.toHaveProperty('type');
    expect(body).not.toHaveProperty('startsAt');
    expect(body).not.toHaveProperty('companyId');
    expect(buildAppointmentBody(form({ contactId: 'k2' }), { version: 1 }).contactId).toBe('k2');
  });
});

describe('agenda : actions selon l’état et les droits', () => {
  const later = new Date(2026, 10, 19);
  const after = new Date(2026, 10, 21);
  it('à venir : modifier, reporter, annuler ; « tenu » seulement une fois l’heure venue', () => {
    expect(appointmentActions(view(), rights(), later)).toEqual(['edit', 'postpone', 'cancel']);
    expect(appointmentActions(view(), rights(), after)).toEqual(['edit', 'postpone', 'hold', 'cancel']);
    expect(appointmentActions(view({ startsAt: new Date(2026, 10, 21, 9, 0).toISOString() }), rights(), new Date(2026, 10, 21, 9, 0))).toContain('hold');
  });
  it('tenu et annulé : aucune action', () => {
    expect(appointmentActions(view({ status: 'HELD' }), rights(), after)).toEqual([]);
    expect(appointmentActions(view({ status: 'CANCELLED' }), rights(), after)).toEqual([]);
  });
  it('les droits décident : lecture seule = rien ; sans annuler = pas d’annulation', () => {
    expect(appointmentActions(view(), rights({ update: false, cancel: false }), after)).toEqual([]);
    expect(appointmentActions(view(), rights({ cancel: false }), after)).toEqual(['edit', 'postpone', 'hold']);
    expect(appointmentActions(view(), rights({ update: false }), after)).toEqual(['cancel']);
  });
  it('une visite suit le droit « visite » pour tout, annulation comprise', () => {
    const visit = view({ type: 'VISIT' });
    expect(appointmentActions(visit, rights({ update: false, cancel: false }), later)).toEqual(['edit', 'postpone', 'cancel']);
    expect(appointmentActions(visit, rights({ visitUpdate: false }), later)).toEqual([]);
  });
  it('libellés des actions', () => {
    expect(APPOINTMENT_ACTION_LABEL.postpone).toBe('Reporter');
    expect(APPOINTMENT_ACTION_LABEL.hold).toBe('Marquer comme tenu');
  });
});

describe('agenda : fenêtres de temps', () => {
  it('semaine : du lundi au dimanche, fin exclue au lundi suivant (minuit local)', () => {
    const w = agendaWindow('week', '2026-11-04');
    expect(w.days).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(w.from).toBe(new Date(2026, 10, 2).toISOString());
    expect(w.to).toBe(new Date(2026, 10, 9).toISOString());
  });
  it('un dimanche appartient à la semaine qui finit ce jour-là, un lundi à celle qui commence', () => {
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(agendaWindow('week', '2026-11-08').days[0]).toBe('2026-11-02');
  });
  it('jour : un seul jour', () => {
    const w = agendaWindow('day', '2026-11-04');
    expect(w.days).toEqual(['2026-11-04']);
    expect(w.to).toBe(new Date(2026, 10, 5).toISOString());
  });
  it('mois : grille de semaines entières (novembre 2026 commence un dimanche et finit un lundi : 6 semaines)', () => {
    const w = agendaWindow('month', '2026-11-15');
    expect(w.days).toHaveLength(42);
    expect(w.days[0]).toBe('2026-10-26');
    expect(w.days[41]).toBe('2026-12-06');
    expect(w.days.length % 7).toBe(0);
    expect(w.from).toBe(new Date(2026, 9, 26).toISOString());
    expect(w.to).toBe(new Date(2026, 11, 7).toISOString());
  });
  it('mois de février 2027 (commence un lundi, finit un dimanche) : 4 semaines pleines', () => {
    const w = agendaWindow('month', '2027-02-10');
    expect(w.days).toHaveLength(28);
    expect(w.days[0]).toBe('2027-02-01');
    expect(w.days[27]).toBe('2027-02-28');
  });
  it('aucune vue ne dépasse la fenêtre de 63 jours acceptée par le serveur', () => {
    for (const month of ['2026-01-15', '2026-02-15', '2026-03-15', '2026-08-15', '2026-11-15', '2027-05-15']) {
      const w = agendaWindow('month', month);
      expect((new Date(w.to).getTime() - new Date(w.from).getTime()) / 86400000).toBeLessThanOrEqual(63);
    }
  });
  it('navigation : un jour, une semaine, un mois (jour borné à la fin du mois)', () => {
    expect(shiftAnchor('day', '2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftAnchor('week', '2026-11-04', -1)).toBe('2026-10-28');
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftAnchor('month', '2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-15');
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-15');
    expect(shiftAnchor('month', '2028-01-31', 1)).toBe('2028-02-29');
  });
  it('titres en français', () => {
    expect(agendaTitle('day', '2026-11-04')).toBe('mercredi 4 novembre 2026');
    expect(agendaTitle('week', '2026-11-04')).toBe('Semaine du 2 au 8 novembre 2026');
    expect(agendaTitle('week', '2026-11-26')).toBe('Semaine du 23 au 29 novembre 2026');
    expect(agendaTitle('week', '2026-12-30')).toBe('Semaine du 28 décembre au 3 janvier 2027');
    expect(agendaTitle('month', '2026-11-04')).toBe('novembre 2026');
    expect(dayHeading('2026-11-04')).toBe('mercredi 4 novembre');
  });
  it('regroupe par jour local en gardant l’ordre du serveur', () => {
    const a = view({ id: 'a', startsAt: new Date(2026, 10, 4, 9, 0).toISOString() });
    const b = view({ id: 'b', startsAt: new Date(2026, 10, 4, 14, 0).toISOString() });
    const c = view({ id: 'c', startsAt: new Date(2026, 10, 5, 8, 0).toISOString() });
    const groups = groupByDay([a, b, c]);
    expect([...groups.keys()]).toEqual(['2026-11-04', '2026-11-05']);
    expect(groups.get('2026-11-04')!.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('paramètres de requête : fenêtre, taille maximale, type éventuel', () => {
    const w = agendaWindow('week', '2026-11-04');
    expect(agendaParams(w, '').toString()).toBe(new URLSearchParams({ from: w.from, to: w.to, pageSize: '200' }).toString());
    expect(agendaParams(w, 'VISIT').get('type')).toBe('VISIT');
    expect(agendaParams(w, '').has('type')).toBe(false);
    expect(startOfLocalDay('2026-11-04')).toBe(new Date(2026, 10, 4).toISOString());
  });
});

describe('agenda : points d’entrée', () => {
  it('le module Agenda est livré (page /agenda, droit de lecture des rendez-vous)', () => {
    expect(MODULES.find((m) => m.id === 'agenda')).toMatchObject({ href: '/agenda', permission: 'bd.appointment.read' });
  });
  it('le menu d’une offre propose « Planifier un rendez-vous » seulement pour une offre en cours et avec le droit', () => {
    expect(availableActions('SUBMITTED', { update: false, withdraw: false, appointmentCreate: true })).toEqual(['appointment']);
    expect(availableActions('RECEIPT_RECEIVED', { update: false, withdraw: false, appointmentCreate: true })).toEqual(['appointment']);
    expect(availableActions('SUBMITTED', { update: false, withdraw: false })).toEqual([]);
    for (const status of ['DRAFT', 'ACCEPTED', 'REFUSED', 'WITHDRAWN']) expect(availableActions(status, { update: false, withdraw: false, appointmentCreate: true })).not.toContain('appointment');
  });
});
