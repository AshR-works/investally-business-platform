import { describe, expect, it } from 'vitest';
import { buildAppointmentBody, EMPTY_APPOINTMENT_FORM, formFromAppointment } from '../lib/appointments';
import { COMPANY_COLUMNS, DEFAULT_COLUMNS, openValueText } from '../lib/company-table';
import type { Appointment } from '../lib/types';

const now = new Date('2026-11-06T10:00:00Z');

describe('rendez-vous lié à une opportunité (D93)', () => {
  const filled = (patch = {}) => EMPTY_APPOINTMENT_FORM({ companyId: 'c1', date: '2026-11-20', time: '09:00', ...patch }, now);

  it('le formulaire vide n’a aucune opportunité liée', () => {
    expect(EMPTY_APPOINTMENT_FORM({}, now).opportunityId).toBe('');
  });
  it('à la planification, l’opportunité choisie part dans la requête ; absente, elle n’y figure pas', () => {
    expect(buildAppointmentBody(filled({ opportunityId: 'op1' }))).toMatchObject({ opportunityId: 'op1' });
    expect(buildAppointmentBody(filled())).not.toHaveProperty('opportunityId');
  });
  it('à la modification, le lien n’est jamais renvoyé (il ne change plus)', () => {
    expect(buildAppointmentBody(filled({ opportunityId: 'op1' }), { version: 2 })).not.toHaveProperty('opportunityId');
  });
  it('reconstitue le lien d’un rendez-vous existant, ou vide', () => {
    const base = { id: 'a1', type: 'DECISION_MAKER', companyId: 'c1', contactId: null, offerId: null, startsAt: '2026-11-20T09:00:00.000Z', durationMinutes: 60, location: null, note: null } as unknown as Appointment;
    expect(formFromAppointment({ ...base, opportunityId: 'op1' }).opportunityId).toBe('op1');
    expect(formFromAppointment({ ...base, opportunityId: null }).opportunityId).toBe('');
  });
});

describe('colonne « Valeur » du tableau des entreprises (S4.3c)', () => {
  it('est proposée et visible par défaut, juste après le responsable', () => {
    expect(COMPANY_COLUMNS.map((c) => c.id)).toContain('value');
    expect(DEFAULT_COLUMNS.indexOf('value')).toBe(DEFAULT_COLUMNS.indexOf('owner') + 1);
  });
  it('affiche le nombre et la valeur d’une devise', () => {
    const text = openValueText({ count: 2, totals: [{ currency: 'XAF', amount: '3000000.50' }] })!.replace(/[  ]/g, ' ');
    expect(text).toMatch(/^2 · 3 000 000,50/);
    expect(text).toContain('FCFA');
  });
  it('écrit les devises l’une après l’autre sans les additionner', () => {
    const text = openValueText({ count: 3, totals: [{ currency: 'EUR', amount: '300.25' }, { currency: 'XAF', amount: '1000' }] })!;
    expect(text.startsWith('3 · ')).toBe(true);
    expect(text).toContain(' + ');
  });
  it('est vide sans droit de lecture (champ absent) ou sans opportunité ouverte', () => {
    expect(openValueText(undefined)).toBeNull();
    expect(openValueText({ count: 0, totals: [] })).toBeNull();
  });
});
