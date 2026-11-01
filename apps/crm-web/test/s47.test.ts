import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de la relance valide les mêmes saisies.
import { Followup } from '../../crm-api/src/modules/business-development/domain/followup';
import {
  addDays, buildFollowupBody, channelLabel, EMPTY_FOLLOWUP_FORM, FOLLOWUP_CHANNELS, FOLLOWUP_FILTERS, FOLLOWUP_STATUS, followupActions, followupListParams, formFromFollowup,
  type FollowupForm, validateClosingText, validateFollowupFields,
} from '../lib/followups';
import { availableActions } from '../lib/offers';
import type { Followup as FollowupView } from '../lib/types';

const now = new Date('2026-11-04T10:00:00Z');
const context = { today: '2026-11-04', needsOffer: false };
const form = (patch: Partial<FollowupForm> = {}): FollowupForm => ({ offerId: 'o1', dueOn: '2026-11-10', channel: 'CALL', note: 'Rappeler le DAF', ...patch });
const serverAccepts = (f: FollowupForm): boolean => {
  try {
    Followup.plan({ id: 'x', offerId: f.offerId, dueOn: f.dueOn, channel: f.channel, note: f.note, now });
    return true;
  } catch {
    return false;
  }
};
const view = (patch: Partial<FollowupView> = {}): FollowupView => ({
  id: 'f1', offerId: 'o1', offerReference: 'OFF-2026-0001', companyId: 'c1', companyName: 'Atlas', dueOn: '2026-11-10', channel: 'CALL', note: 'Rappeler', status: 'PLANNED',
  resultNote: null, closedAt: null, overdue: false, createdAt: '2026-11-04T10:00:00Z', version: 2, ...patch,
});

describe('relances : dates et formulaire', () => {
  it('ajoute des jours à une date, sans décalage de fuseau', () => {
    expect(addDays('2026-11-04', 7)).toBe('2026-11-11');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2026-02-26', 3)).toBe('2026-03-01');
  });
  it('propose une première relance à sept jours, par appel', () => {
    expect(EMPTY_FOLLOWUP_FORM('o1', now)).toEqual({ offerId: 'o1', dueOn: '2026-11-11', channel: 'CALL', note: '' });
  });
  it('préremplit la modification', () => {
    expect(formFromFollowup(view({ note: null }))).toEqual({ offerId: 'o1', dueOn: '2026-11-10', channel: 'CALL', note: '' });
  });
});

describe('relances : saisie identique à celle du serveur', () => {
  it.each([
    [{}], [{ dueOn: '2026-11-04' }], [{ dueOn: '2026-11-03' }], [{ dueOn: '' }], [{ dueOn: '2026-02-31' }], [{ dueOn: '10/11/2026' }],
    [{ channel: 'EMAIL' }], [{ channel: 'WHATSAPP' }], [{ channel: 'MEETING' }], [{ channel: 'OTHER' }], [{ channel: 'PIGEON' }], [{ channel: '' }],
    [{ note: '' }], [{ note: 'x'.repeat(500) }], [{ note: 'x'.repeat(501) }],
  ])('%j : l’interface et le serveur répondent pareil', (patch) => {
    const f = form(patch);
    expect(Object.keys(validateFollowupFields(f, context)).length === 0, JSON.stringify(patch)).toBe(serverAccepts(f));
  });
  it('les canaux de l’interface sont exactement ceux du serveur, en français', () => {
    expect(FOLLOWUP_CHANNELS.map((c) => c.value).sort()).toEqual(['CALL', 'EMAIL', 'MEETING', 'OTHER', 'WHATSAPP']);
    expect(channelLabel('CALL')).toBe('Appel');
    expect(channelLabel('INCONNU')).toBe('INCONNU');
  });
  it('l’offre est exigée à la planification mais pas à la modification', () => {
    expect(validateFollowupFields(form({ offerId: '' }), { ...context, needsOffer: true }).offerId).toMatch(/offre/);
    expect(validateFollowupFields(form({ offerId: '' }), context)).toEqual({});
  });
  it('une relance en retard garde son échéance passée mais n’en accepte pas une autre', () => {
    const late = { ...context, keepDueOn: '2026-11-01' };
    expect(validateFollowupFields(form({ dueOn: '2026-11-01' }), late)).toEqual({});
    expect(validateFollowupFields(form({ dueOn: '2026-11-02' }), late).dueOn).toMatch(/passé/);
  });
  it('corps de création (offre incluse, note vide omise) et de modification (version lue, jamais l’offre)', () => {
    expect(buildFollowupBody(form({ note: '' }))).toEqual({ dueOn: '2026-11-10', channel: 'CALL', offerId: 'o1' });
    const update = buildFollowupBody(form({ note: '' }), { version: 2 });
    expect(update).toEqual({ dueOn: '2026-11-10', channel: 'CALL', note: '', version: 2 });
    expect(update).not.toHaveProperty('offerId');
  });
  it('résultat ou motif de clôture : trois caractères au moins, la limite au plus', () => {
    expect(validateClosingText('ok', 500)).toMatch(/obligatoire/);
    expect(validateClosingText('   ', 500)).toMatch(/obligatoire/);
    expect(validateClosingText('Le DAF rappellera', 500)).toBeNull();
    expect(validateClosingText('x'.repeat(501), 500)).toMatch(/500/);
  });
});

describe('relances : actions, filtres et états', () => {
  it('seule une relance à faire propose des actions, selon les droits', () => {
    expect(followupActions('PLANNED', { complete: true, update: true })).toEqual(['complete', 'edit', 'cancel']);
    expect(followupActions('PLANNED', { complete: true, update: false })).toEqual(['complete']);
    expect(followupActions('PLANNED', { complete: false, update: true })).toEqual(['edit', 'cancel']);
    for (const status of ['DONE', 'CANCELLED', 'INCONNU']) expect(followupActions(status, { complete: true, update: true }), status).toEqual([]);
  });
  it('chaque filtre rapide se traduit en paramètres de requête ; l’offre est ajoutée si elle est donnée', () => {
    expect(followupListParams('todo', 1, 20).toString()).toBe('page=1&pageSize=20&status=PLANNED');
    expect(followupListParams('overdue', 2, 20).get('due')).toBe('overdue');
    expect(followupListParams('today', 1, 20).get('due')).toBe('today');
    expect(followupListParams('upcoming', 1, 20).get('due')).toBe('upcoming');
    expect(followupListParams('done', 1, 20).get('status')).toBe('DONE');
    expect(followupListParams('cancelled', 1, 20, 'o1').get('offerId')).toBe('o1');
    expect(FOLLOWUP_FILTERS.map((f) => f.label)).toEqual(['À faire', 'En retard', 'Aujourd’hui', 'À venir', 'Terminées', 'Annulées']);
  });
  it('les états de l’interface sont ceux du serveur, en français', () => {
    expect(Object.keys(FOLLOWUP_STATUS).sort()).toEqual(['CANCELLED', 'DONE', 'PLANNED']);
    expect(FOLLOWUP_STATUS.PLANNED?.label).toBe('À faire');
  });
  it('le menu d’une offre propose « Relances » dès qu’elle a été déposée, avec le droit de lecture', () => {
    const rights = { update: true, withdraw: true, followupRead: true };
    expect(availableActions('SUBMITTED', rights)).toEqual(['followups', 'accept', 'refuse', 'withdraw']);
    expect(availableActions('ACCEPTED', rights)).toEqual(['followups']);
    expect(availableActions('DRAFT', rights)).toEqual(['edit', 'submit', 'withdraw']);
    expect(availableActions('SUBMITTED', { update: true, withdraw: true })).toEqual(['accept', 'refuse', 'withdraw']);
  });
});
