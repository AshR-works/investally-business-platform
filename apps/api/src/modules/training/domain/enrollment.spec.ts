import { DomainError } from '../../../shared-kernel';
import { assertApprovalCovers, assertApprovalValid, CoverApproval } from './approval-cover';
import { Enrollment } from './enrollment';
import { Learner } from './learner';
import { amountLabel, fromCents, toCents } from './money';

const NOW = new Date('2026-11-06T09:00:00.000Z');
const expectError = (fn: () => unknown, code: string, message: RegExp) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    expect((error as DomainError).message).toMatch(message);
    return;
  }
  throw new Error('une erreur de domaine était attendue');
};

describe('Montants en centimes', () => {
  it('convertit sans passer par des nombres à virgule', () => {
    expect(toCents('750000.00')).toBe(75_000_000);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('12.05')).toBe(1205);
    expect(fromCents(75_000_000)).toBe('750000.00');
    expect(fromCents(1205)).toBe('12.05');
    expect(toCents(fromCents(toCents('999999999999.99')))).toBe(toCents('999999999999.99'));
    expect(amountLabel(125_000_050)).toBe('1 250 000,50');
    expect(amountLabel(75_000_000)).toBe('750 000');
    for (const bad of ['', 'abc', '1,5', '1.234', '-5']) expectError(() => toCents(bad), 'VALIDATION', /illisible/);
  });
});

const approval = (over: Partial<CoverApproval> = {}): CoverApproval => ({ status: 'RECEIVED', amount: null, places: 2, currency: 'XAF', validUntil: null, ...over });
const certificate = { fullPrice: '750000.00', currency: 'XAF' };
const none = { places: 0, cents: 0 };

describe('Un agrément couvre-t-il une inscription ?', () => {
  it('n\'autorise que Reçu ou Honoré', () => {
    expect(() => assertApprovalValid({ status: 'RECEIVED', validUntil: null }, '2026-11-16')).not.toThrow();
    expect(() => assertApprovalValid({ status: 'HONORED', validUntil: null }, '2026-11-16')).not.toThrow();
    expectError(() => assertApprovalValid({ status: 'REQUESTED', validUntil: null }, '2026-11-16'), 'INVARIANT_VIOLATION', /seulement demandé/);
    expectError(() => assertApprovalValid({ status: 'EXPIRED', validUntil: null }, '2026-11-16'), 'INVARIANT_VIOLATION', /expiré/);
    expectError(() => assertApprovalValid({ status: 'CANCELLED', validUntil: null }, '2026-11-16'), 'INVARIANT_VIOLATION', /annulé/);
  });

  it('exige que la fin de validité couvre le début de la session (le dernier jour inclus)', () => {
    expect(() => assertApprovalValid({ status: 'RECEIVED', validUntil: '2026-11-16' }, '2026-11-16')).not.toThrow();
    expectError(() => assertApprovalValid({ status: 'RECEIVED', validUntil: '2026-11-15' }, '2026-11-16'), 'INVARIANT_VIOLATION', /expire le 2026-11-15, avant le début/);
  });

  it('compte une place par inscription pour un agrément en places', () => {
    expect(assertApprovalCovers(approval(), '2026-11-16', certificate, { places: 1, cents: 0 })).toEqual({ chargedAmount: null });
    expectError(() => assertApprovalCovers(approval(), '2026-11-16', certificate, { places: 2, cents: 0 }), 'INVARIANT_VIOLATION', /n'a plus de place \(2 utilisées sur 2\)/);
  });

  it('compte le prix complet du certificat pour un agrément en somme, au centime près', () => {
    const sum = approval({ places: null, amount: '1500000.00' });
    expect(assertApprovalCovers(sum, '2026-11-16', certificate, none)).toEqual({ chargedAmount: '750000.00' });
    expect(assertApprovalCovers(sum, '2026-11-16', certificate, { places: 1, cents: 75_000_000 })).toEqual({ chargedAmount: '750000.00' }); // 1 500 000 = 2 × 750 000 exactement
    expectError(() => assertApprovalCovers(sum, '2026-11-16', certificate, { places: 1, cents: 75_000_001 }), 'INVARIANT_VIOLATION', /montant restant.*749 999,99.*750 000/);
  });

  it('applique les deux plafonds quand l\'agrément porte les places et la somme', () => {
    const both = approval({ places: 5, amount: '1000000.00' });
    expect(assertApprovalCovers(both, '2026-11-16', certificate, none).chargedAmount).toBe('750000.00');
    expectError(() => assertApprovalCovers(both, '2026-11-16', certificate, { places: 1, cents: 75_000_000 }), 'INVARIANT_VIOLATION', /montant restant/);
    const places = approval({ places: 1, amount: '9000000.00' });
    expectError(() => assertApprovalCovers(places, '2026-11-16', certificate, { places: 1, cents: 75_000_000 }), 'INVARIANT_VIOLATION', /plus de place/);
  });

  it('refuse un certificat sans prix complet ou dans une autre devise sous un agrément en somme, pas sous un agrément en places', () => {
    const sum = approval({ places: null, amount: '1500000.00' });
    expectError(() => assertApprovalCovers(sum, '2026-11-16', { fullPrice: null, currency: null }, none), 'INVARIANT_VIOLATION', /pas de prix complet/);
    expectError(() => assertApprovalCovers(sum, '2026-11-16', { fullPrice: '750000.00', currency: 'EUR' }, none), 'INVARIANT_VIOLATION', /EUR.*XAF|aucune conversion/);
    expect(assertApprovalCovers(approval(), '2026-11-16', { fullPrice: null, currency: null }, none)).toEqual({ chargedAmount: null });
  });
});

describe('Inscription', () => {
  const enrollment = () => Enrollment.create({ id: 'e1', sessionId: 's1', learnerId: 'l1', companyId: 'c1', approvalId: 'a1', chargedAmount: '750000.00', comment: '  Prise en charge employeur ', now: NOW });

  it('naît en attente, occupe une place et garde son commentaire nettoyé', () => {
    const e = enrollment();
    expect(e).toMatchObject({ status: 'PENDING', occupiesSeat: true, comment: 'Prise en charge employeur', chargedAmount: '750000.00', version: 1 });
  });

  it('se confirme une seule fois, depuis « en attente »', () => {
    const e = enrollment();
    e.confirm(NOW);
    expect(e).toMatchObject({ status: 'CONFIRMED', occupiesSeat: true, confirmedAt: NOW });
    expectError(() => e.confirm(NOW), 'INVARIANT_VIOLATION', /déjà confirmée/);
    const cancelled = enrollment();
    cancelled.cancel('Désistement');
    expectError(() => cancelled.confirm(NOW), 'INVARIANT_VIOLATION', /annulée/);
  });

  it('s\'annule avec un motif obligatoire et libère sa place', () => {
    const e = enrollment();
    expectError(() => e.cancel('   '), 'VALIDATION', /motif/);
    e.confirm(NOW);
    e.cancel('  Désistement du client ');
    expect(e).toMatchObject({ status: 'CANCELLED', cancelReason: 'Désistement du client', occupiesSeat: false, confirmedAt: null });
    expectError(() => e.cancel('Encore'), 'INVARIANT_VIOLATION', /déjà annulée/);
  });

  it('passe « à replacer » depuis en attente ou confirmée, libère la place, et se lie à son remplacement une fois annulée', () => {
    const e = enrollment();
    e.confirm(NOW);
    e.markToReplace();
    expect(e).toMatchObject({ status: 'TO_REPLACE', occupiesSeat: false, confirmedAt: null });
    expectError(() => e.markToReplace(), 'INVARIANT_VIOLATION', /en attente ou confirmée/);
    expectError(() => e.linkReplacement('e2'), 'INVARIANT_VIOLATION', /annulée/);
    e.cancel('Replacée sur une autre session');
    e.linkReplacement('e2');
    expect(e.replacedById).toBe('e2');
  });
});

describe('Apprenant', () => {
  const learner = () => Learner.create({ id: 'l1', companyId: 'c1', lastName: '  Mbarga ', firstName: 'Aïcha', email: ' AICHA@Exemple.TEST ', phone: '+237 699 00 11 22', now: NOW });

  it('normalise le nom, l\'e-mail et le téléphone ; la clé de nom ignore la casse', () => {
    const l = learner();
    expect(l).toMatchObject({ lastName: 'Mbarga', email: 'aicha@exemple.test', phone: '+237699001122', fullName: 'Aïcha Mbarga', nameKey: 'aïcha mbarga', deleted: false, version: 1 });
  });

  it('refuse un nom ou un prénom vide, un e-mail ou un téléphone invalide', () => {
    expectError(() => Learner.create({ id: 'x', companyId: 'c', lastName: ' ', firstName: 'A', now: NOW }), 'VALIDATION', /nom/);
    expectError(() => Learner.create({ id: 'x', companyId: 'c', lastName: 'A', firstName: '', now: NOW }), 'VALIDATION', /prénom/);
    expectError(() => Learner.create({ id: 'x', companyId: 'c', lastName: 'A', firstName: 'B', email: 'pas-un-email', now: NOW }), 'VALIDATION', /e-mail/i);
    expectError(() => Learner.create({ id: 'x', companyId: 'c', lastName: 'A', firstName: 'B', phone: '0699123456', now: NOW }), 'VALIDATION', /./);
  });

  it('se modifie par champs (absent = inchangé, vide = effacé) et ne se modifie plus une fois supprimé', () => {
    const l = learner();
    l.update({ firstName: 'Aïssatou', email: '', contactId: 'k1' });
    expect(l).toMatchObject({ firstName: 'Aïssatou', lastName: 'Mbarga', email: null, contactId: 'k1', phone: '+237699001122' });
    l.update({ contactId: null });
    expect(l.contactId).toBeNull();
    l.markDeleted(NOW);
    expect(l.deleted).toBe(true);
    expectError(() => l.update({ firstName: 'X' }), 'INVARIANT_VIOLATION', /supprimé/);
    expectError(() => l.markDeleted(NOW), 'INVARIANT_VIOLATION', /supprimé/);
  });
});
