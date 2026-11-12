import { DomainError } from '../../../shared-kernel';
import { Employee } from './employee';

const now = new Date('2026-11-09T10:00:00Z');
const base = { id: 'e1', lastName: 'Ndzana', firstName: 'Claire', jobTitle: 'Chargée de compte', department: 'Commercial', hiredOn: '2026-03-02', now };
const make = (extra: Partial<Parameters<typeof Employee.register>[0]> = {}) => Employee.register({ ...base, ...extra });
const refuses = (fn: () => unknown, pattern: RegExp) => {
  expect(fn).toThrow(DomainError);
  expect(fn).toThrow(pattern);
};

describe('Employee — création', () => {
  it('crée un employé actif : champs nettoyés, matricule en majuscules, e-mail en minuscules, téléphone normalisé, version 1', () => {
    const e = make({ lastName: '  Ndzana  ', firstName: ' Claire   Marie ', matricule: ' inv-0042 ', workEmail: 'Claire.Ndzana@Investally.TEST', workPhone: '+237 699 00 11 22' });
    expect(e).toMatchObject({ lastName: 'Ndzana', firstName: 'Claire Marie', matricule: 'INV-0042', workEmail: 'claire.ndzana@investally.test', workPhone: '+237699001122', status: 'ACTIVE', leftOn: null, version: 1, managerEmployeeId: null, userId: null });
    expect(e.fullName).toBe('Claire Marie Ndzana');
  });

  it('exige nom, prénom, poste et service, de longueur bornée', () => {
    refuses(() => make({ lastName: '  ' }), /nom est obligatoire/);
    refuses(() => make({ firstName: '' }), /prénom est obligatoire/);
    refuses(() => make({ jobTitle: '' }), /poste est obligatoire/);
    refuses(() => make({ department: ' ' }), /service est obligatoire/);
    refuses(() => make({ lastName: 'x'.repeat(101) }), /100 caractères/);
    refuses(() => make({ jobTitle: 'x'.repeat(151) }), /150 caractères/);
  });

  it('le matricule est facultatif ; seuls lettres, chiffres et . - / _ sont admis', () => {
    expect(make({ matricule: '   ' }).matricule).toBeNull();
    expect(make({ matricule: 'a.b-1/2_3' }).matricule).toBe('A.B-1/2_3');
    refuses(() => make({ matricule: 'a b' }), /matricule/);
    refuses(() => make({ matricule: '-x' }), /matricule/);
    refuses(() => make({ matricule: 'x'.repeat(31) }), /matricule/);
  });

  it('refuse une date d’entrée irréelle, un e-mail ou un téléphone invalides ; les deux derniers sont facultatifs', () => {
    refuses(() => make({ hiredOn: '2026-02-31' }), /date d'entrée/);
    refuses(() => make({ hiredOn: 'hier' }), /date d'entrée/);
    refuses(() => make({ workEmail: 'pas-un-email' }), /./);
    refuses(() => make({ workPhone: 'abc' }), /./);
    expect(make({ workEmail: '', workPhone: '' })).toMatchObject({ workEmail: null, workPhone: null });
  });

  it('n’est jamais son propre responsable', () => {
    refuses(() => make({ managerEmployeeId: 'e1' }), /propre responsable/);
    expect(make({ managerEmployeeId: 'e0' }).managerEmployeeId).toBe('e0');
  });

  it('ne porte aucune donnée sensible : l’entité n’a ni salaire, ni adresse personnelle, ni date de naissance (D57)', () => {
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(make())).join(' ').toLowerCase();
    for (const sensitive of ['salary', 'salaire', 'birth', 'naissance', 'address', 'adresse', 'passport', 'identity', 'health']) expect(keys).not.toContain(sensitive);
  });
});

describe('Employee — modification', () => {
  it('modifie les champs donnés : absent = inchangé, vide = effacé, null = retiré', () => {
    const e = make({ workEmail: 'a@b.test', managerEmployeeId: 'e0', userId: 'u1', matricule: 'X1' });
    e.update({ jobTitle: 'Responsable', workEmail: '', managerEmployeeId: null, userId: null, matricule: '' });
    expect(e).toMatchObject({ jobTitle: 'Responsable', department: 'Commercial', workEmail: null, managerEmployeeId: null, userId: null, matricule: null });
  });
  it('tout ou rien : une saisie invalide ne laisse aucune modification', () => {
    const e = make();
    refuses(() => e.update({ jobTitle: 'Nouveau', department: '' }), /service est obligatoire/);
    expect(e.jobTitle).toBe('Chargée de compte');
    refuses(() => e.update({ managerEmployeeId: 'e1' }), /propre responsable/);
  });
});

describe('Employee — archivage (sortie du personnel, réversible)', () => {
  it('archive avec la date de sortie (par défaut aujourd’hui) et un motif nettoyé ; réactive sans trace', () => {
    const e = make();
    e.archive({ reason: '  Fin de contrat ', now });
    expect(e).toMatchObject({ status: 'ARCHIVED', isArchived: true, leftOn: '2026-11-09', archiveReason: 'Fin de contrat', archivedAt: now });
    e.reactivate();
    expect(e).toMatchObject({ status: 'ACTIVE', leftOn: null, archiveReason: null, archivedAt: null });
  });
  it('la date de sortie peut être donnée ; elle ne précède pas l’entrée ; le motif est borné', () => {
    const e = make();
    e.archive({ leftOn: '2026-12-31', now });
    expect(e.leftOn).toBe('2026-12-31');
    const f = make();
    refuses(() => f.archive({ leftOn: '2026-03-01', now }), /précéder/);
    refuses(() => f.archive({ leftOn: '2026-13-01', now }), /date de sortie/);
    refuses(() => f.archive({ reason: 'x'.repeat(501), now }), /500/);
    expect(f.isArchived).toBe(false);
    expect(make().archive({ leftOn: '2026-03-02', now })).toBeUndefined();
  });
  it('refuse un double archivage, la réactivation d’un actif et toute modification pendant l’archivage', () => {
    const e = make();
    refuses(() => e.reactivate(), /pas archivé/);
    e.archive({ now });
    refuses(() => e.archive({ now }), /déjà archivé/);
    refuses(() => e.update({ jobTitle: 'x' }), /réactivez/);
  });
});
