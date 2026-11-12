import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'ambassadeur valide les mêmes saisies.
import { Ambassador } from '../../api/src/modules/business-development/domain/ambassador';
import {
  AMBASSADOR_ORIGINS, type AmbassadorForm, buildAmbassadorBody, EMPTY_AMBASSADOR_FORM, formFromAmbassador, originLabel, sinceLabel, validateAmbassadorFields,
} from '../lib/ambassadors';
import { MODULES } from '../lib/modules';
import type { Ambassador as AmbassadorView } from '../lib/types';

const now = new Date('2026-11-08T10:00:00Z');
const today = '2026-11-08';
const form = (patch: Partial<AmbassadorForm> = {}): AmbassadorForm => ({
  lastName: 'Fotso', firstName: 'Alain', origin: 'CLIENT', companyId: 'c1', email: 'alain@exemple.cm', phone: '+237 699 00 11 22', appointedOn: '2026-11-05', note: '', ...patch,
});
const serverAccepts = (f: AmbassadorForm): boolean => {
  try {
    Ambassador.register({
      id: 'x', ownerUserId: 'u1', lastName: f.lastName, firstName: f.firstName, origin: f.origin, companyId: f.companyId || null,
      email: f.email, phone: f.phone, appointedOn: f.appointedOn, note: f.note, now,
    });
    return true;
  } catch {
    return false;
  }
};
const view = (patch: Partial<AmbassadorView> = {}): AmbassadorView => ({
  id: 'a1', lastName: 'Fotso', firstName: 'Alain', origin: 'CLIENT', companyId: 'c1', companyName: 'Atlas', email: 'alain@exemple.cm', phone: null,
  appointedOn: '2026-03-10', note: null, status: 'ACTIVE', archivedAt: null, archiveReason: null, ownerUserId: 'u1', createdAt: '2026-11-08T10:00:00Z', version: 2, ...patch,
});

describe('ambassadeur : saisie', () => {
  it('le formulaire vide propose l’origine « Client » et la date du jour', () => {
    expect(EMPTY_AMBASSADOR_FORM(now)).toMatchObject({ origin: 'CLIENT', appointedOn: today, lastName: '', companyId: '' });
  });
  it('accepte une saisie complète, ou un apprenant sans entreprise', () => {
    expect(validateAmbassadorFields(form(), { today })).toEqual({});
    expect(validateAmbassadorFields(form({ origin: 'LEARNER', companyId: '' }), { today })).toEqual({});
  });
  it('nom et prénom obligatoires, 100 caractères au plus', () => {
    expect(validateAmbassadorFields(form({ lastName: ' ' }), { today }).lastName).toMatch(/obligatoire/);
    expect(validateAmbassadorFields(form({ firstName: '' }), { today }).firstName).toMatch(/obligatoire/);
    expect(validateAmbassadorFields(form({ lastName: 'x'.repeat(101) }), { today }).lastName).toMatch(/100/);
  });
  it('un client exige son entreprise ; un apprenant non', () => {
    expect(validateAmbassadorFields(form({ companyId: '' }), { today }).companyId).toMatch(/rattaché/);
    expect(validateAmbassadorFields(form({ origin: 'LEARNER', companyId: '' }), { today }).companyId).toBeUndefined();
    expect(validateAmbassadorFields(form({ origin: 'AUTRE' }), { today }).origin).toMatch(/origine/);
  });
  it('contrôle l’e-mail, le téléphone, la date de début et la note', () => {
    expect(validateAmbassadorFields(form({ email: 'pas-un-mail' }), { today }).email).toMatch(/e-mail/);
    expect(validateAmbassadorFields(form({ phone: 'abc' }), { today }).phone).toMatch(/numéro/);
    expect(validateAmbassadorFields(form({ appointedOn: '' }), { today }).appointedOn).toMatch(/obligatoire/);
    expect(validateAmbassadorFields(form({ appointedOn: '2026-02-31' }), { today }).appointedOn).toMatch(/pas valide/);
    expect(validateAmbassadorFields(form({ appointedOn: '2026-11-09' }), { today }).appointedOn).toMatch(/futur/);
    expect(validateAmbassadorFields(form({ note: 'x'.repeat(501) }), { today }).note).toMatch(/500/);
  });
});

describe('ambassadeur : corps des requêtes', () => {
  it('à la création, l’origine part et les champs facultatifs vides sont omis', () => {
    expect(buildAmbassadorBody(form({ email: '', phone: '', note: '' }))).toEqual({ lastName: 'Fotso', firstName: 'Alain', appointedOn: '2026-11-05', origin: 'CLIENT', companyId: 'c1' });
    expect(buildAmbassadorBody(form({ origin: 'LEARNER', companyId: '' }))).not.toHaveProperty('companyId');
  });
  it('à la modification, la version part, jamais l’origine ; un champ vidé est envoyé vide ; une entreprise retirée part en null', () => {
    const body = buildAmbassadorBody(form({ origin: 'LEARNER', companyId: '', phone: '', note: '' }), { version: 3 });
    expect(body).toMatchObject({ version: 3, phone: '', note: '', companyId: null });
    expect(body).not.toHaveProperty('origin');
  });
  it('reconstitue le formulaire d’un ambassadeur existant', () => {
    expect(formFromAmbassador(view())).toEqual({ lastName: 'Fotso', firstName: 'Alain', origin: 'CLIENT', companyId: 'c1', email: 'alain@exemple.cm', phone: '', appointedOn: '2026-03-10', note: '' });
  });
});

describe('cohérence avec le domaine réel du serveur', () => {
  const cases: Partial<AmbassadorForm>[] = [
    {}, { origin: 'LEARNER', companyId: '' }, { companyId: '' }, { origin: 'AUTRE' }, { lastName: ' ' }, { firstName: '' }, { lastName: 'x'.repeat(101) },
    { email: 'pas-un-mail' }, { phone: 'abc' }, { email: '', phone: '' }, { appointedOn: '2026-02-31' }, { appointedOn: '2026-11-09' }, { appointedOn: '2026-11-08' }, { note: 'x'.repeat(501) },
  ];
  it.each(cases.map((c, i) => [i, c] as const))('saisie %i : l’interface et le serveur décident pareil', (_i, patch) => {
    const f = form(patch);
    expect(Object.keys(validateAmbassadorFields(f, { today })).length === 0).toBe(serverAccepts(f));
  });
});

describe('ambassadeur : libellés et module', () => {
  it('libellés d’origine', () => {
    expect(AMBASSADOR_ORIGINS.map((o) => o.value)).toEqual(['CLIENT', 'LEARNER']);
    expect(originLabel('CLIENT')).toBe('Client');
    expect(originLabel('LEARNER')).toBe('Apprenant');
    expect(originLabel('X')).toBe('X');
  });
  it('« Depuis » s’écrit mois/année', () => {
    expect(sinceLabel('2026-03-10')).toBe('03/2026');
    expect(sinceLabel('2025-12-01')).toBe('12/2025');
  });
  it('le module « Ambassadeurs » est livré dans le hub, sous le droit de lecture', () => {
    const m = MODULES.find((x) => x.id === 'ambassadors');
    expect(m).toMatchObject({ href: '/ambassadors', permission: 'bd.ambassador.read', label: 'Ambassadeurs' });
  });
});
