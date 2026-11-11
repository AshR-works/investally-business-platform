import { DomainError } from '../../../shared-kernel';
import { Ambassador, AmbassadorOrigin } from './ambassador';

const now = new Date('2026-11-08T10:00:00Z');
const base = { id: 'a1', ownerUserId: 'u1', lastName: 'Fotso', firstName: 'Alain', origin: 'CLIENT', companyId: 'c1', appointedOn: '2026-11-05', now };
const register = (patch: Partial<Parameters<typeof Ambassador.register>[0]> = {}) => Ambassador.register({ ...base, ...patch });

describe('Ambassador — création manuelle', () => {
  it('crée un ambassadeur client : champs normalisés, responsable = créateur, version 1', () => {
    const a = register({ lastName: '  Fotso ', firstName: 'Alain   Pierre', email: ' Alain.Fotso@Exemple.CM ', phone: '+237 699 00 11 22', note: '  Relais à Douala ' });
    expect(a).toMatchObject({
      lastName: 'Fotso', firstName: 'Alain Pierre', origin: AmbassadorOrigin.Client, companyId: 'c1', email: 'alain.fotso@exemple.cm',
      phone: '+237699001122', appointedOn: '2026-11-05', note: 'Relais à Douala', ownerUserId: 'u1', version: 1,
    });
  });

  it('un apprenant peut n’avoir aucune entreprise ; un client est toujours rattaché à la sienne', () => {
    expect(register({ origin: 'LEARNER', companyId: null })).toMatchObject({ origin: AmbassadorOrigin.Learner, companyId: null });
    expect(register({ origin: 'LEARNER', companyId: 'c1' }).companyId).toBe('c1');
    expect(() => register({ origin: 'CLIENT', companyId: null })).toThrow(/rattaché à son entreprise/);
    expect(() => register({ origin: 'CLIENT', companyId: '' })).toThrow(DomainError);
  });

  it('refuse une origine inconnue ou absente', () => {
    expect(() => register({ origin: 'AUTRE' })).toThrow(/origine/);
    expect(() => register({ origin: '' })).toThrow(/origine/);
  });

  it('exige un nom et un prénom de 100 caractères au plus', () => {
    expect(() => register({ lastName: '  ' })).toThrow(/Le nom est obligatoire/);
    expect(() => register({ firstName: '' })).toThrow(/Le prénom est obligatoire/);
    expect(() => register({ lastName: 'x'.repeat(101) })).toThrow(/100 caractères/);
  });

  it('refuse un e-mail ou un téléphone invalide ; les deux sont facultatifs', () => {
    expect(() => register({ email: 'pas-un-mail' })).toThrow(/e-mail/);
    expect(() => register({ phone: 'abc' })).toThrow(/numéro/);
    expect(register({ email: '', phone: '' })).toMatchObject({ email: null, phone: null });
  });

  it('la date de début est réelle, pas dans le futur', () => {
    expect(() => register({ appointedOn: '2026-02-31' })).toThrow(/date valide/);
    expect(() => register({ appointedOn: '05/11/2026' })).toThrow(/date valide/);
    expect(() => register({ appointedOn: '2026-11-09' })).toThrow(/futur/);
    expect(register({ appointedOn: '2026-11-08' }).appointedOn).toBe('2026-11-08');
  });

  it('la note est facultative et limitée à 500 caractères', () => {
    expect(register({ note: '' }).note).toBeNull();
    expect(() => register({ note: 'x'.repeat(501) })).toThrow(/500 caractères/);
  });

  it('exige un responsable', () => {
    expect(() => register({ ownerUserId: '' })).toThrow(/responsable/);
  });
});

describe('Ambassador — modification', () => {
  it('modifie les champs donnés : absent = inchangé, vide = effacé', () => {
    const a = register({ email: 'a@exemple.cm', phone: '+237 699 00 11 22', note: 'Note' });
    a.update({ lastName: 'Ndzana', phone: '', note: '' }, now);
    expect(a).toMatchObject({ lastName: 'Ndzana', firstName: 'Alain', email: 'a@exemple.cm', phone: null, note: null });
  });

  it('l’origine ne change pas ; un client ne peut pas perdre son entreprise', () => {
    const client = register();
    expect(() => client.update({ companyId: null }, now)).toThrow(/rattaché à son entreprise/);
    expect(client.companyId).toBe('c1');
    const learner = register({ origin: 'LEARNER', companyId: 'c1' });
    learner.update({ companyId: null }, now);
    expect(learner.companyId).toBeNull();
    expect(learner.origin).toBe(AmbassadorOrigin.Learner);
  });

  it('tout ou rien : une saisie invalide ne laisse aucune modification', () => {
    const a = register();
    expect(() => a.update({ lastName: 'Nouveau', email: 'invalide' }, now)).toThrow(DomainError);
    expect(a.lastName).toBe('Fotso');
    expect(() => a.update({ appointedOn: '2099-01-01' }, now)).toThrow(/futur/);
    expect(a.appointedOn).toBe('2026-11-05');
  });
});

describe('Ambassador — archivage (N5)', () => {
  const make = () => Ambassador.register({ id: 'a1', ownerUserId: 'u1', lastName: 'Zola', firstName: 'Ève', origin: 'LEARNER', appointedOn: '2026-11-01', now: new Date('2026-11-08T10:00:00Z') });
  const later = new Date('2026-11-09T08:00:00Z');

  it('naît actif ; archive avec date et motif nettoyé ; réactive sans trace', () => {
    const a = make();
    expect(a).toMatchObject({ status: 'ACTIVE', archivedAt: null, archiveReason: null, isArchived: false });
    a.archive('  trop  tard ', later);
    expect(a).toMatchObject({ status: 'ARCHIVED', archivedAt: later, archiveReason: 'trop  tard', isArchived: true });
    a.reactivate();
    expect(a).toMatchObject({ status: 'ACTIVE', archivedAt: null, archiveReason: null });
  });

  it('un motif vide devient absent ; 500 caractères au plus', () => {
    const a = make();
    a.archive('   ', later);
    expect(a.archiveReason).toBeNull();
    const b = make();
    expect(() => b.archive('x'.repeat(501), later)).toThrow(/500/);
    expect(b.isArchived).toBe(false);
  });

  it('refuse un double archivage, la réactivation d’un actif, et toute modification pendant l’archivage', () => {
    const a = make();
    expect(() => a.reactivate()).toThrow(/pas archivé/);
    a.archive(null, later);
    expect(() => a.archive(null, later)).toThrow(/déjà archivé/);
    expect(() => a.update({ lastName: 'Autre' }, later)).toThrow(/réactivez/);
    expect(a.lastName).toBe('Zola');
  });
});
