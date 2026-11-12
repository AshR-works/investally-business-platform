import { END_REASON_CODES } from '../presentation/dto/contract.dto';
import { Contract, ContractType, END_REASONS, validateContractDates } from './contract';

const now = new Date('2026-11-10T09:00:00Z');
const base = { id: 'c1', employeeId: 'e1', contractTypeId: 't1', now };

describe('ContractType', () => {
  it('normalise le code en majuscules et refuse un code mal formé', () => {
    expect(ContractType.create({ id: 't', code: ' apprenti ', label: 'Apprenti', fixedTerm: true, now }).code).toBe('APPRENTI');
    for (const code of ['', 'A', '1CDI', 'CD-I', 'X'.repeat(31)]) expect(() => ContractType.create({ id: 't', code, label: 'L', fixedTerm: false, now })).toThrow();
  });

  it('exige un libellé et un ordre dans les bornes', () => {
    expect(() => ContractType.create({ id: 't', code: 'CDI', label: '   ', fixedTerm: false, now })).toThrow(/libellé/);
    expect(() => ContractType.create({ id: 't', code: 'CDI', label: 'x'.repeat(101), fixedTerm: false, now })).toThrow(/100/);
    expect(() => ContractType.create({ id: 't', code: 'CDI', label: 'L', fixedTerm: false, sortOrder: 10_001, now })).toThrow();
    expect(() => ContractType.create({ id: 't', code: 'CDI', label: 'L', fixedTerm: false, sortOrder: -1, now })).toThrow();
  });

  it('se désactive sans changer son code ni sa nature', () => {
    const type = ContractType.create({ id: 't', code: 'CDD', label: 'CDD', fixedTerm: true, now });
    type.update({ label: 'Contrat à durée déterminée', active: false, sortOrder: 5 });
    expect(type).toMatchObject({ code: 'CDD', fixedTerm: true, active: false, sortOrder: 5, label: 'Contrat à durée déterminée' });
  });
});

describe('validateContractDates', () => {
  it('un contrat à durée déterminée exige une fin, un contrat à durée indéterminée n’en a pas', () => {
    expect(() => validateContractDates({ start: '2026-12-01' }, true)).toThrow(/obligatoire/);
    expect(() => validateContractDates({ start: '2026-12-01', end: '2027-01-01' }, false)).toThrow(/indéterminée/);
    expect(validateContractDates({ start: '2026-12-01' }, false)).toEqual({ start: '2026-12-01', end: null, probationEnd: null });
  });

  it('la fin ne précède pas le début (le même jour est permis)', () => {
    expect(() => validateContractDates({ start: '2026-12-02', end: '2026-12-01' }, true)).toThrow(/précéder/);
    expect(validateContractDates({ start: '2026-12-01', end: '2026-12-01' }, true).end).toBe('2026-12-01');
  });

  it('la période d’essai tombe dans le contrat, bornes comprises', () => {
    expect(() => validateContractDates({ start: '2026-12-01', probationEnd: '2026-11-30' }, false)).toThrow(/précéder/);
    expect(() => validateContractDates({ start: '2026-12-01', end: '2027-03-01', probationEnd: '2027-03-02' }, true)).toThrow(/dépasser/);
    expect(validateContractDates({ start: '2026-12-01', end: '2027-03-01', probationEnd: '2027-03-01' }, true).probationEnd).toBe('2027-03-01');
    expect(validateContractDates({ start: '2026-12-01', probationEnd: '2026-12-01' }, false).probationEnd).toBe('2026-12-01');
  });

  it('refuse une date impossible ou mal écrite', () => {
    for (const start of ['2026-02-30', '01/12/2026', '', '2026-13-01']) expect(() => validateContractDates({ start }, false)).toThrow(/date valide/);
  });
});

describe('Contract', () => {
  const cdd = () => Contract.create({ ...base, fixedTerm: true, start: '2026-12-01', end: '2027-05-31', probationEnd: '2027-01-31' });

  it('commence en cours, sans motif de fin', () => {
    expect(cdd()).toMatchObject({ status: 'ACTIVE', isActive: true, endedOn: null, endReason: null, lastDay: '2027-05-31', version: 1 });
    expect(Contract.create({ ...base, fixedTerm: false, start: '2026-12-01' }).lastDay).toBeNull();
  });

  it('se prolonge sans jamais changer le début', () => {
    const c = cdd();
    c.adjust({ end: '2027-08-31' }, true);
    expect(c).toMatchObject({ start: '2026-12-01', end: '2027-08-31', probationEnd: '2027-01-31' });
    c.adjust({ probationEnd: null }, true);
    expect(c.probationEnd).toBeNull();
    expect(() => c.adjust({ end: null }, true)).toThrow(/obligatoire/);
    expect(() => c.adjust({ end: '2026-11-30' }, true)).toThrow(/précéder/);
  });

  it('se termine avec une date et un motif de la liste fermée', () => {
    const c = cdd();
    c.finish({ endedOn: '2027-05-31', reason: 'FIXED_TERM_END' });
    expect(c).toMatchObject({ status: 'ENDED', isActive: false, endedOn: '2027-05-31', endReason: 'FIXED_TERM_END', lastDay: '2027-05-31' });
  });

  it('refuse un motif hors liste, y compris un texte libre', () => {
    for (const reason of ['', 'Licenciement pour faute', 'resignation', 'fixed_term_end']) expect(() => cdd().finish({ endedOn: '2027-01-01', reason })).toThrow(/liste/);
    for (const reason of END_REASONS) expect(() => cdd().finish({ endedOn: '2027-01-01', reason })).not.toThrow();
  });

  it('la date de fin effective reste dans le contrat (début et fin prévue inclus)', () => {
    expect(() => cdd().finish({ endedOn: '2026-11-30', reason: 'OTHER' })).toThrow(/précéder/);
    expect(() => cdd().finish({ endedOn: '2027-06-01', reason: 'OTHER' })).toThrow(/prolongez/);
    expect(() => cdd().finish({ endedOn: '2026-12-01', reason: 'OTHER' })).not.toThrow();
    const cdi = Contract.create({ ...base, fixedTerm: false, start: '2026-12-01' });
    expect(() => cdi.finish({ endedOn: '2040-01-01', reason: 'RESIGNATION' })).not.toThrow();
  });

  it('la fin effective prime sur la fin prévue : un contrat terminé en avance a pour dernier jour sa fin effective', () => {
    const c = cdd();
    expect(c.lastDay).toBe('2027-05-31');
    c.finish({ endedOn: '2027-01-15', reason: 'RESIGNATION' });
    expect(c.lastDay).toBe('2027-01-15');
  });

  it('un contrat terminé ne se modifie ni ne se termine plus', () => {
    const c = cdd();
    c.finish({ endedOn: '2027-01-01', reason: 'OTHER' });
    expect(() => c.adjust({ end: '2027-09-01' }, true)).toThrow(/terminé/);
    expect(() => c.finish({ endedOn: '2027-01-02', reason: 'OTHER' })).toThrow(/déjà terminé/);
  });
});

it('la liste des motifs de l’API est celle du domaine', () => {
  expect([...END_REASON_CODES]).toEqual([...END_REASONS]);
});
