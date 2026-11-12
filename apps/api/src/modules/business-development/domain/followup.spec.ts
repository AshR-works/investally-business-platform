import { Followup, FollowupChannel, FollowupStatus } from './followup';

const now = new Date('2026-11-04T10:00:00Z');
const make = (extra: Record<string, unknown> = {}) =>
  Followup.plan({ id: 'f1', offerId: 'o1', dueOn: '2026-11-10', channel: 'CALL', note: '  Rappeler le DAF  ', now, ...extra });

describe('Relance — planification', () => {
  it('est « à faire » dès la planification ; la note est nettoyée, la version vaut 1', () => {
    expect(make()).toMatchObject({ status: FollowupStatus.Planned, dueOn: '2026-11-10', channel: FollowupChannel.Call, note: 'Rappeler le DAF', resultNote: null, closedAt: null, version: 1 });
  });
  it('accepte l’échéance du jour ; une note vide devient « aucune »', () => {
    expect(make({ dueOn: '2026-11-04' }).dueOn).toBe('2026-11-04');
    expect(make({ note: '   ' }).note).toBeNull();
    expect(make({ note: undefined }).note).toBeNull();
  });
  it.each([
    [{ dueOn: '2026-11-03' }], [{ dueOn: '2026-02-31' }], [{ dueOn: '10/11/2026' }], [{ dueOn: '' }],
    [{ channel: 'PIGEON' }], [{ channel: '' }], [{ note: 'x'.repeat(501) }], [{ offerId: '' }],
  ])('refuse %j', (patch) => {
    expect(() => make(patch)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
  it('reconnaît chaque canal', () => {
    for (const channel of ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'OTHER']) expect(make({ channel }).channel).toBe(channel);
  });
});

describe('Relance — en retard', () => {
  it('à faire et échéance dépassée seulement : le jour même n’est pas en retard, une relance close ne l’est jamais', () => {
    const f = make({ dueOn: '2026-11-04' });
    expect(f.isOverdue(now)).toBe(false);
    expect(f.isOverdue(new Date('2026-11-05T00:00:00Z'))).toBe(true);
    f.complete('Rappelé, rendez-vous pris', new Date('2026-11-05T09:00:00Z'));
    expect(f.isOverdue(new Date('2026-11-09T00:00:00Z'))).toBe(false);
  });
});

describe('Relance — modification', () => {
  it('change l’échéance, le canal et la note ; absent = inchangé, note vide = effacée', () => {
    const f = make();
    f.edit({ dueOn: '2026-11-12', channel: 'EMAIL' }, now);
    expect(f).toMatchObject({ dueOn: '2026-11-12', channel: 'EMAIL', note: 'Rappeler le DAF' });
    f.edit({ note: '' }, now);
    expect(f.note).toBeNull();
  });
  it('une nouvelle échéance ne peut pas être dans le passé, mais une échéance déjà passée peut rester telle quelle', () => {
    const f = make({ dueOn: '2026-11-04' });
    const later = new Date('2026-11-09T10:00:00Z');
    expect(() => f.edit({ dueOn: '2026-11-08' }, later)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    f.edit({ dueOn: '2026-11-04', note: 'Relance en retard' }, later);
    expect(f).toMatchObject({ dueOn: '2026-11-04', note: 'Relance en retard' });
  });
  it('tout ou rien : une erreur ne change aucun champ', () => {
    const f = make();
    expect(() => f.edit({ channel: 'EMAIL', dueOn: 'demain' }, now)).toThrow();
    expect(f.channel).toBe(FollowupChannel.Call);
  });
});

describe('Relance — clôture', () => {
  it('terminée avec son résultat nettoyé et sa date de clôture', () => {
    const f = make();
    f.complete('  Le DAF rappellera jeudi  ', now);
    expect(f).toMatchObject({ status: FollowupStatus.Done, resultNote: 'Le DAF rappellera jeudi', closedAt: now });
  });
  it('annulée avec son motif', () => {
    const f = make();
    f.cancel('Offre retirée', now);
    expect(f).toMatchObject({ status: FollowupStatus.Cancelled, resultNote: 'Offre retirée', closedAt: now });
  });
  it.each([[undefined], [''], ['ok'], ['x'.repeat(1001)]])('le résultat %j est refusé sans rien changer', (text) => {
    const f = make();
    expect(() => f.complete(text as string | undefined, now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(f.status).toBe(FollowupStatus.Planned);
  });
  it.each([[undefined], ['ok'], ['x'.repeat(501)]])('le motif %j est refusé sans rien changer', (text) => {
    const f = make();
    expect(() => f.cancel(text as string | undefined, now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(f.status).toBe(FollowupStatus.Planned);
  });
  it('une relance close est définitive : ni terminée, ni annulée, ni modifiée', () => {
    for (const close of [(f: Followup) => f.complete('Fait', now), (f: Followup) => f.cancel('Motif', now)]) {
      const f = make();
      close(f);
      expect(() => f.complete('Encore', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
      expect(() => f.cancel('Encore', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
      expect(() => f.edit({ note: 'Encore' }, now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    }
  });
});
