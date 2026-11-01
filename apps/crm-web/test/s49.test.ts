import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'opportunité valide les mêmes saisies.
import { LossReason, Opportunity, OpportunityStage } from '../../crm-api/src/modules/business-development/domain/opportunity';
import { MODULES } from '../lib/modules';
import {
  advanceLabel, buildOpportunityBody, EMPTY_OPPORTUNITY_FORM, formFromOpportunity, groupByStage, LOSS_REASONS, lossReasonLabel, OPPORTUNITY_FILTERS, OPPORTUNITY_SOURCES,
  OPPORTUNITY_STAGES, OPPORTUNITY_STATUS, type OpportunityForm, opportunityActions, opportunityListParams, type OpportunityRights, sourceLabel, stageLabel, totalAmount,
  validateLoss, validateOpportunityFields, validateRequiredText,
} from '../lib/opportunities';
import type { Opportunity as OpportunityView } from '../lib/types';

const now = new Date('2026-11-05T10:00:00Z');
const form = (patch: Partial<OpportunityForm> = {}): OpportunityForm => ({ companyId: 'c1', title: 'Formation fiscalité', amount: '12 500 000', currency: 'XAF', source: 'REFERRAL', ...patch });
const view = (patch: Partial<OpportunityView> = {}): OpportunityView => ({
  id: 'p1', companyId: 'c1', companyName: 'Atlas', title: 'Formation', amount: '1000.00', currency: 'XAF', source: 'REFERRAL', stage: 'QUALIFICATION', nextStage: 'PROPOSAL', status: 'OPEN',
  lossReason: null, closingNote: null, closedAt: null, waiverReason: null, waivedAt: null, stageChangedAt: '2026-11-05T10:00:00Z', lastActivityAt: '2026-11-05T10:00:00Z',
  createdAt: '2026-11-05T10:00:00Z', version: 1, ...patch,
});
const rights = (patch: Partial<OpportunityRights> = {}): OpportunityRights => ({ update: true, advance: true, override: false, closeLost: true, closeWon: false, ...patch });
const serverAccepts = (f: OpportunityForm): boolean => {
  try {
    Opportunity.create({ id: 'x', companyId: f.companyId, title: f.title, amount: f.amount, currency: f.currency, source: f.source, now });
    return true;
  } catch {
    return false;
  }
};

describe('opportunités : étapes, états et listes fermées', () => {
  it('les cinq étapes sont dans l’ordre du serveur', () => {
    expect(OPPORTUNITY_STAGES.map((s) => s.value)).toEqual(Object.values(OpportunityStage));
    expect(stageLabel('AGREEMENT_IN_PRINCIPLE')).toBe('Accord de principe');
    expect(stageLabel(null)).toBe('—');
    expect(stageLabel('INCONNUE')).toBe('INCONNUE');
  });
  it('les motifs de perte et les sources sont ceux du serveur', () => {
    expect(LOSS_REASONS.map((r) => r.value)).toEqual(Object.values(LossReason));
    expect(OPPORTUNITY_SOURCES.map((s) => s.value)).toEqual(['PROSPECTING', 'REFERRAL', 'EVENT', 'INBOUND', 'OTHER']);
    expect(lossReasonLabel('NO_BUDGET')).toBe('Pas de budget');
    expect(lossReasonLabel(null)).toBe('—');
    expect(sourceLabel('EVENT')).toBe('Événement');
  });
  it('trois états lisibles', () => {
    expect(OPPORTUNITY_STATUS.OPEN!.label).toBe('Ouverte');
    expect(OPPORTUNITY_STATUS.WON!.label).toBe('Gagnée');
    expect(OPPORTUNITY_STATUS.LOST!.label).toBe('Perdue');
  });
  it('le module Opportunités est livré (page /opportunities, droit de lecture)', () => {
    expect(MODULES.find((m) => m.id === 'opportunities')).toMatchObject({ href: '/opportunities', permission: 'bd.opportunity.read' });
  });
});

describe('opportunités : contrôles de saisie', () => {
  const ctx = { needsCompany: true };
  it('accepte une saisie complète', () => {
    expect(validateOpportunityFields(form(), ctx)).toEqual({});
  });
  it.each([
    [{ companyId: '' }, 'companyId'], [{ title: '' }, 'title'], [{ title: '   ' }, 'title'], [{ title: 'x'.repeat(201) }, 'title'], [{ amount: '' }, 'amount'], [{ amount: '0' }, 'amount'],
    [{ amount: '-5' }, 'amount'], [{ amount: 'beaucoup' }, 'amount'], [{ amount: '1.234' }, 'amount'], [{ currency: 'EURO' }, 'currency'], [{ source: 'PIGEON' }, 'source'],
  ] as [Partial<OpportunityForm>, string][])('signale %j sur le champ %s', (patch, field) => {
    expect(Object.keys(validateOpportunityFields(form(patch), ctx))).toContain(field);
  });
  it('à la modification, l’entreprise n’est pas contrôlée', () => {
    expect(validateOpportunityFields(form({ companyId: '' }), { needsCompany: false })).toEqual({});
  });
  it('le serveur réel accepte et refuse les mêmes saisies', () => {
    const cases: Partial<OpportunityForm>[] = [
      {}, { amount: '12500000,5' }, { amount: '1' }, { currency: 'eur' }, { currency: 'FCFA' }, { currency: '' }, { source: 'EVENT' }, { title: 'x'.repeat(200) },
      { title: '' }, { title: '  ' }, { title: 'x'.repeat(201) }, { amount: '0' }, { amount: '-5' }, { amount: 'x' }, { amount: '1.234' }, { amount: '' }, { currency: 'EURO' }, { source: 'PIGEON' }, { companyId: '' },
    ];
    for (const patch of cases) {
      const f = form(patch);
      const clientOk = Object.keys(validateOpportunityFields(f, ctx)).length === 0;
      expect([JSON.stringify(patch), clientOk]).toEqual([JSON.stringify(patch), serverAccepts(f)]);
    }
  });
  it('texte obligatoire de la dérogation : trois caractères au moins, la limite au plus', () => {
    expect(validateRequiredText('', 500)).not.toBeNull();
    expect(validateRequiredText('ab', 500)).not.toBeNull();
    expect(validateRequiredText('abc', 500)).toBeNull();
    expect(validateRequiredText('x'.repeat(500), 500)).toBeNull();
    expect(validateRequiredText('x'.repeat(501), 500)).not.toBeNull();
  });
  it('perte : motif de la liste, précision obligatoire pour « autre » (comme le serveur)', () => {
    expect(validateLoss('', '').reason).toBeDefined();
    expect(validateLoss('RAISON', '').reason).toBeDefined();
    expect(validateLoss('PRICE', '')).toEqual({});
    expect(validateLoss('OTHER', '').note).toBeDefined();
    expect(validateLoss('OTHER', 'ab').note).toBeDefined();
    expect(validateLoss('OTHER', 'Projet reporté')).toEqual({});
    expect(validateLoss('PRICE', 'x'.repeat(501)).note).toBeDefined();
    for (const [reason, note] of [['PRICE', null], ['OTHER', null], ['OTHER', 'ab'], ['OTHER', 'Projet reporté'], ['RAISON', null], ['', null]] as const) {
      const o = Opportunity.create({ id: 'x', companyId: 'c1', title: 'T', amount: '10', source: 'EVENT', now });
      let serverOk = true;
      try { o.closeLost(reason, note, now); } catch { serverOk = false; }
      const found = validateLoss(reason, note ?? '');
      expect([reason, note, !found.reason && !found.note]).toEqual([reason, note, serverOk]);
    }
  });
});

describe('opportunités : corps des requêtes', () => {
  it('création : entreprise incluse, devise seulement si saisie', () => {
    expect(buildOpportunityBody(form({ title: '  Titre  ', amount: ' 500 ' }))).toEqual({ title: 'Titre', amount: '500', source: 'REFERRAL', currency: 'XAF', companyId: 'c1' });
    expect(buildOpportunityBody(form({ currency: '  ' }))).not.toHaveProperty('currency');
  });
  it('modification : la version lue, jamais l’entreprise', () => {
    const body = buildOpportunityBody(form(), { version: 3 });
    expect(body).toMatchObject({ version: 3 });
    expect(body).not.toHaveProperty('companyId');
  });
  it('formulaire d’une opportunité existante ; formulaire vide avec entreprise imposée', () => {
    expect(formFromOpportunity(view({ amount: '1500.50' }))).toEqual({ companyId: 'c1', title: 'Formation', amount: '1500.50', currency: 'XAF', source: 'REFERRAL' });
    expect(EMPTY_OPPORTUNITY_FORM('c9')).toMatchObject({ companyId: 'c9', title: '', currency: 'XAF', source: 'PROSPECTING' });
  });
});

describe('opportunités : actions selon l’état, l’étape et les droits', () => {
  it('ouverte : fiche, modifier, avancer, clore perdue ; pas de dérogation ni de clôture gagnée sans le droit', () => {
    expect(opportunityActions(view(), rights())).toEqual(['details', 'edit', 'advance', 'close-lost']);
  });
  it('la dérogation : avant l’accord de principe, une seule fois, avec le droit', () => {
    const r = rights({ override: true });
    expect(opportunityActions(view({ stage: 'NEGOTIATION', nextStage: 'AGREEMENT_IN_PRINCIPLE' }), r)).toContain('waiver');
    expect(opportunityActions(view({ stage: 'NEGOTIATION', nextStage: 'AGREEMENT_IN_PRINCIPLE', waivedAt: '2026-11-05T10:00:00Z' }), r)).not.toContain('waiver');
    expect(opportunityActions(view({ stage: 'AGREEMENT_IN_PRINCIPLE', nextStage: 'ACCREDITATION' }), r)).not.toContain('waiver');
    expect(opportunityActions(view({ stage: 'NEGOTIATION' }), rights())).not.toContain('waiver');
  });
  it('clore gagnée : seulement à partir de l’accord de principe et avec le droit (D28)', () => {
    const r = rights({ closeWon: true });
    expect(opportunityActions(view({ stage: 'NEGOTIATION', nextStage: 'AGREEMENT_IN_PRINCIPLE' }), r)).not.toContain('close-won');
    expect(opportunityActions(view({ stage: 'AGREEMENT_IN_PRINCIPLE', nextStage: 'ACCREDITATION' }), r)).toContain('close-won');
    expect(opportunityActions(view({ stage: 'ACCREDITATION', nextStage: null }), r)).toContain('close-won');
    expect(opportunityActions(view({ stage: 'ACCREDITATION', nextStage: null }), rights())).not.toContain('close-won');
  });
  it('à la dernière étape, plus d’avancement', () => {
    expect(opportunityActions(view({ stage: 'ACCREDITATION', nextStage: null }), rights())).not.toContain('advance');
  });
  it('clôturée (gagnée ou perdue) : seulement la fiche, quels que soient les droits', () => {
    const all = rights({ override: true, closeWon: true });
    expect(opportunityActions(view({ status: 'LOST' }), all)).toEqual(['details']);
    expect(opportunityActions(view({ status: 'WON', stage: 'ACCREDITATION', nextStage: null }), all)).toEqual(['details']);
  });
  it('lecture seule : seulement la fiche', () => {
    expect(opportunityActions(view(), rights({ update: false, advance: false, closeLost: false }))).toEqual(['details']);
  });
  it('libellé « Déplacer vers… » avec l’étape visée', () => {
    expect(advanceLabel('PROPOSAL')).toBe('Déplacer vers « Proposition »');
  });
});

describe('opportunités : regroupement, totaux et requêtes', () => {
  const items = [
    view({ id: 'a', stage: 'PROPOSAL', amount: '1000.50' }), view({ id: 'b', stage: 'QUALIFICATION', amount: '2000.25' }),
    view({ id: 'c', stage: 'PROPOSAL', amount: '500.00' }),
  ];
  it('regroupe par étape dans l’ordre du pipeline, en gardant l’ordre reçu', () => {
    const groups = groupByStage(items);
    expect(groups.map((g) => g.stage)).toEqual(Object.values(OpportunityStage));
    expect(groups.find((g) => g.stage === 'PROPOSAL')!.items.map((o) => o.id)).toEqual(['a', 'c']);
    expect(groups.find((g) => g.stage === 'NEGOTIATION')!.items).toEqual([]);
  });
  it('total exact en centimes, sans erreur d’arrondi ; vide ou devises mêlées : pas de total', () => {
    expect(totalAmount(items)).toEqual({ amount: '3500.75', currency: 'XAF' });
    expect(totalAmount([view({ amount: '0.10' }), view({ amount: '0.20' })])).toEqual({ amount: '0.30', currency: 'XAF' });
    expect(totalAmount([])).toBeNull();
    expect(totalAmount([view(), view({ currency: 'EUR' })])).toBeNull();
  });
  it('paramètres de la liste : taille maximale, filtre, recherche', () => {
    expect(opportunityListParams('open', '').toString()).toBe('page=1&pageSize=200&status=OPEN');
    expect(opportunityListParams('lost', ' alpha ').toString()).toBe('page=1&pageSize=200&status=LOST&search=alpha');
    expect(opportunityListParams('all', '').has('status')).toBe(false);
    expect(OPPORTUNITY_FILTERS.map((f) => f.value)).toEqual(['open', 'won', 'lost', 'all']);
  });
});
