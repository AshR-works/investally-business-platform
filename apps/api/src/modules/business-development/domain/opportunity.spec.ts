import { LossReason, Opportunity, OpportunitySource, OpportunityStage, OpportunityStatus, STAGE_ORDER } from './opportunity';

const now = new Date('2026-11-05T10:00:00Z');
const later = new Date('2026-11-06T10:00:00Z');
const make = (extra: Record<string, unknown> = {}) =>
  Opportunity.create({ id: 'p1', companyId: 'c1', title: '  Formation  fiscalité  ', amount: '12 500 000,5', source: 'REFERRAL', now, ...extra });
const met = { decisionMakerMeetingHeld: true };
const notMet = { decisionMakerMeetingHeld: false };
/** Une opportunité amenée à l'étape donnée (rendez-vous décideur tenu). */
const at = (stage: OpportunityStage) => {
  const o = make();
  while (o.stage !== stage) o.advance(met, now);
  return o;
};

describe('Opportunité — création', () => {
  it('commence à « Qualification », ouverte ; intitulé et montant normalisés, XAF par défaut, version 1', () => {
    expect(make()).toMatchObject({
      title: 'Formation fiscalité', amount: '12500000.50', currency: 'XAF', source: OpportunitySource.Referral, stage: OpportunityStage.Qualification,
      status: OpportunityStatus.Open, lossReason: null, closedAt: null, waivedAt: null, version: 1, isOpen: true,
    });
    expect(make({ currency: 'fcfa' }).currency).toBe('XAF');
    expect(make({ currency: 'eur' }).currency).toBe('EUR');
  });
  it.each([
    [{ title: '' }], [{ title: '   ' }], [{ title: 'x'.repeat(201) }], [{ amount: '0' }], [{ amount: '-5' }], [{ amount: 'beaucoup' }], [{ amount: '1.234' }],
    [{ amount: '' }], [{ source: 'PIGEON' }], [{ source: '' }], [{ currency: 'EURO' }], [{ companyId: '' }],
  ])('refuse %j', (patch) => {
    expect(() => make(patch)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
});

describe('Opportunité — modification', () => {
  it('modifie intitulé, montant, devise et source ; tout ou rien en cas de refus', () => {
    const o = make();
    o.edit({ title: 'Nouveau titre', amount: 800, currency: 'EUR', source: 'EVENT' });
    expect(o).toMatchObject({ title: 'Nouveau titre', amount: '800.00', currency: 'EUR', source: OpportunitySource.Event });
    expect(() => o.edit({ title: 'Autre', amount: 'x' })).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(o.title).toBe('Nouveau titre');
  });
  it('une opportunité clôturée est immuable', () => {
    const o = make();
    o.closeLost('PRICE', null, later);
    expect(() => o.edit({ title: 'Trop tard' })).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION', message: 'Une opportunité clôturée est immuable' }));
  });
});

describe('Opportunité — étapes', () => {
  it('avance une étape à la fois, dans l’ordre, et date chaque passage', () => {
    const o = make();
    const seen: OpportunityStage[] = [o.stage];
    for (let i = 0; i < 4; i++) {
      o.advance(met, later);
      seen.push(o.stage);
    }
    expect(seen).toEqual(STAGE_ORDER);
    expect(o.stageChangedAt).toEqual(later);
  });
  it('la dernière étape n’a pas de suivante : avancer est refusé', () => {
    const o = at(OpportunityStage.Accreditation);
    expect(o.nextStage).toBeNull();
    expect(() => o.advance(met, later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('dernière étape') }));
  });
  it('l’étape suivante se calcule', () => {
    expect(make().nextStage).toBe(OpportunityStage.Proposal);
    expect(at(OpportunityStage.Negotiation).nextStage).toBe(OpportunityStage.AgreementInPrinciple);
  });
});

describe('Opportunité — règle du rendez-vous décideur', () => {
  it('l’accord de principe est refusé sans rendez-vous décideur tenu, avec renvoi vers la dérogation', () => {
    const o = at(OpportunityStage.Negotiation);
    expect(() => o.advance(notMet, later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('dérogation') }));
    expect(o.stage).toBe(OpportunityStage.Negotiation);
  });
  it('accordé avec un rendez-vous décideur tenu', () => {
    const o = at(OpportunityStage.Negotiation);
    o.advance(met, later);
    expect(o.stage).toBe(OpportunityStage.AgreementInPrinciple);
  });
  it('accordé avec une dérogation, sans rendez-vous', () => {
    const o = at(OpportunityStage.Negotiation);
    o.grantWaiver('  Le décideur est injoignable  ', later);
    expect(o).toMatchObject({ waiverReason: 'Le décideur est injoignable', waivedAt: later });
    o.advance(notMet, later);
    expect(o.stage).toBe(OpportunityStage.AgreementInPrinciple);
  });
  it('les autres étapes ne demandent aucun rendez-vous', () => {
    const o = make();
    o.advance(notMet, later);
    o.advance(notMet, later);
    expect(o.stage).toBe(OpportunityStage.Negotiation);
  });
  it('dérogation : justification obligatoire, une seule fois, jamais après l’accord de principe, jamais sur une clôturée', () => {
    const o = make();
    expect(() => o.grantWaiver('', later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => o.grantWaiver('ab', later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => o.grantWaiver('x'.repeat(501), later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    o.grantWaiver('Justification valable', later);
    expect(() => o.grantWaiver('Encore une', later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(() => at(OpportunityStage.AgreementInPrinciple).grantWaiver('Inutile', later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    const lost = make();
    lost.closeLost('PRICE', null, later);
    expect(() => lost.grantWaiver('Trop tard', later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
});

describe('Opportunité — clôture perdue', () => {
  it('perdue avec un motif de la liste fermée : définitive, avec sa date', () => {
    const o = make();
    o.closeLost('PRICE', '  Trop cher de 20 %  ', later);
    expect(o).toMatchObject({ status: OpportunityStatus.Lost, lossReason: LossReason.Price, closingNote: 'Trop cher de 20 %', closedAt: later, isOpen: false });
    expect(() => o.closeLost('PRICE', null, later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(() => o.advance(met, later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(() => o.closeWon(later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
  it('possible à toute étape ; la précision est facultative sauf pour « autre »', () => {
    for (const stage of STAGE_ORDER) {
      const o = at(stage);
      o.closeLost('COMPETITOR', null, later);
      expect(o.closingNote).toBeNull();
    }
    expect(() => make().closeLost('OTHER', null, later)).toThrow(expect.objectContaining({ code: 'VALIDATION', message: expect.stringContaining('autre') }));
    expect(() => make().closeLost('OTHER', 'ab', later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    const o = make();
    o.closeLost('OTHER', 'Projet reporté à 2027', later);
    expect(o.closingNote).toBe('Projet reporté à 2027');
  });
  it.each([[undefined], [''], ['RAISON_INCONNUE']])('motif %s refusé, rien ne bouge', (reason) => {
    const o = make();
    expect(() => o.closeLost(reason, null, later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(o.status).toBe(OpportunityStatus.Open);
  });
  it('précision de plus de 500 caractères refusée', () => {
    expect(() => make().closeLost('PRICE', 'x'.repeat(501), later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
});

describe('Opportunité — clôture gagnée', () => {
  it.each([OpportunityStage.Qualification, OpportunityStage.Proposal, OpportunityStage.Negotiation])('refusée à l’étape %s (avant l’accord de principe)', (stage) => {
    const o = at(stage);
    expect(() => o.closeWon(later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('accord de principe') }));
    expect(o.status).toBe(OpportunityStatus.Open);
  });
  it.each([OpportunityStage.AgreementInPrinciple, OpportunityStage.Accreditation])('possible à l’étape %s, définitive', (stage) => {
    const o = at(stage);
    o.closeWon(later);
    expect(o).toMatchObject({ status: OpportunityStatus.Won, closedAt: later, lossReason: null, isOpen: false });
    expect(() => o.closeWon(later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(() => o.closeLost('PRICE', null, later)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
});
