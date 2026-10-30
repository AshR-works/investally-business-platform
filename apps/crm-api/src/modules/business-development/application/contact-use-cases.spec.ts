import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants, visibilityFor } from '../../iam';
import { InMemoryContacts } from '../../../../test/support/in-memory-contacts';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { DeleteContactUseCase, GetContactHandler, ListContactsHandler, RegisterContactUseCase, UpdateContactUseCase } from './contact-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-10-30T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const contacts = new InMemoryContacts(companies);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `ct-${++seq}` };
  const company = (id: string, owner: string, name = `Société ${id}`) => {
    const c = Company.register({ id, name, ownerUserId: owner, now });
    companies.items.push(c);
    return c;
  };
  return {
    companies, contacts, audit, company,
    register: new RegisterContactUseCase(contacts, companies, recorder, unitOfWork, clock, ids),
    update: new UpdateContactUseCase(contacts, companies, recorder, unitOfWork),
    remove: new DeleteContactUseCase(contacts, companies, recorder, unitOfWork),
    get: new GetContactHandler(contacts, companies),
    list: new ListContactsHandler(contacts, companies),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const base = { lastName: 'Fotso', firstName: 'Alain', role: 'FINANCE_DIRECTOR', email: ' A.Fotso@Atlas.CM ', phone: '+237 6 99 00 11 22' };

describe('Contacts — création', () => {
  it("crée un contact pour une entreprise de sa portée : e-mail normalisé, fonction conservée, audit", async () => {
    const w = build(); w.company('c1', 'am1');
    const view = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    expect(view).toMatchObject({ companyId: 'c1', companyName: 'Société c1', lastName: 'Fotso', firstName: 'Alain', role: 'FINANCE_DIRECTOR', email: 'a.fotso@atlas.cm', version: 1 });
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Contact', entityId: view.id });
  });
  it('fonction par défaut : « Autre » ; e-mail et téléphone facultatifs', async () => {
    const w = build(); w.company('c1', 'am1');
    expect(await w.register.execute({ companyId: 'c1', lastName: 'Eto', firstName: 'Marc', access: am1, actor })).toMatchObject({ role: 'OTHER', email: null, phone: null });
  });
  it("IDOR : l'entreprise d'un collègue est « introuvable », comme un identifiant inexistant, et rien n'est créé", async () => {
    const w = build(); w.company('c1', 'am1');
    const am2 = as(RoleCode.AccountManager, 'am2');
    const real = await w.register.execute({ companyId: 'c1', ...base, access: am2, actor }).catch((e) => e);
    const missing = await w.register.execute({ companyId: 'inconnue', ...base, access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.contacts.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });
  it("le Responsable commercial crée pour un subordonné direct (Équipe), pas pour une autre équipe ; Finance et Support n'ont pas le droit", async () => {
    const w = build(); w.company('c1', 'am1');
    await expect(w.register.execute({ companyId: 'c1', ...base, access: as(RoleCode.HeadOfSales, 'chef', ['am1']), actor })).resolves.toBeDefined();
    await expect(w.register.execute({ companyId: 'c1', lastName: 'Autre', firstName: 'X', access: as(RoleCode.HeadOfSales, 'autre', ['am2']), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const role of [RoleCode.Finance, RoleCode.Support, RoleCode.Direction]) {
      await expect(w.register.execute({ companyId: 'c1', lastName: 'Y', firstName: 'Z', access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
  it('une entreprise archivée n’accepte plus de contact', async () => {
    const w = build(); w.company('c1', 'am1').archive();
    await expect(w.register.execute({ companyId: 'c1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it.each([
    [{ lastName: '' }], [{ firstName: '   ' }], [{ email: 'pas-un-mail' }], [{ phone: 'abc' }], [{ role: 'PATRON' }], [{ lastName: 'x'.repeat(101) }],
  ])('refuse la saisie invalide %j, sans rien créer', async (patch) => {
    const w = build(); w.company('c1', 'am1');
    await expect(w.register.execute({ companyId: 'c1', ...base, ...patch, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.contacts.items).toHaveLength(0);
  });
  describe('doublons', () => {
    it('même nom (sans tenir compte de la casse ni des espaces) dans la même entreprise : conflit', async () => {
      const w = build(); w.company('c1', 'am1');
      await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
      await expect(w.register.execute({ companyId: 'c1', lastName: ' FOTSO ', firstName: 'alain', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    });
    it('même e-mail dans la même entreprise : conflit, même avec un autre nom', async () => {
      const w = build(); w.company('c1', 'am1');
      await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
      await expect(w.register.execute({ companyId: 'c1', lastName: 'Autre', firstName: 'Nom', email: 'a.fotso@atlas.cm', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    });
    it('« créer quand même » après avertissement ; une autre entreprise n\'est jamais un doublon', async () => {
      const w = build(); w.company('c1', 'am1'); w.company('c2', 'am1');
      await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
      await expect(w.register.execute({ companyId: 'c1', ...base, allowDuplicate: true, access: am1, actor })).resolves.toBeDefined();
      await expect(w.register.execute({ companyId: 'c2', ...base, access: am1, actor })).resolves.toBeDefined();
    });
  });
});

describe('Contacts — modification', () => {
  async function setup() {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    w.audit.length = 0;
    return { ...w, id: created.id, version: created.version };
  }
  it("modifie les champs donnés ; audit de l'ancienne et de la nouvelle valeur ; une chaîne vide efface", async () => {
    const w = await setup();
    const view = await w.update.execute({ id: w.id, version: w.version, role: 'DECISION_MAKER', phone: '', access: am1, actor });
    expect(view).toMatchObject({ role: 'DECISION_MAKER', phone: null, lastName: 'Fotso' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { role: 'FINANCE_DIRECTOR' }, newValue: { role: 'DECISION_MAKER' } });
  });
  it('version périmée : conflit, rien n\'est modifié ni tracé', async () => {
    const w = await setup();
    await expect(w.update.execute({ id: w.id, version: w.version + 1, role: 'OTHER', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.contacts.items[0].role).toBe('FINANCE_DIRECTOR');
    expect(w.audit).toHaveLength(0);
  });
  it('une validation qui échoue ne laisse aucune modification partielle', async () => {
    const w = await setup();
    await expect(w.update.execute({ id: w.id, version: w.version, role: 'OTHER', email: 'pas-un-mail', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.contacts.items[0].role).toBe('FINANCE_DIRECTOR');
  });
  it('renommer vers le nom d\'un AUTRE contact : conflit ; garder son propre nom : permis', async () => {
    const w = await setup();
    await w.register.execute({ companyId: 'c1', lastName: 'Ndzana', firstName: 'Claire', access: am1, actor });
    await expect(w.update.execute({ id: w.id, version: w.version, lastName: 'Ndzana', firstName: 'Claire', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.update.execute({ id: w.id, version: w.version, lastName: 'FOTSO', access: am1, actor })).resolves.toMatchObject({ lastName: 'FOTSO' });
  });
  it("IDOR : le contact d'un collègue est « introuvable » et reste intact ; Finance et Support ne modifient pas", async () => {
    const w = await setup();
    const am2 = as(RoleCode.AccountManager, 'am2');
    const real = await w.update.execute({ id: w.id, version: w.version, role: 'OTHER', access: am2, actor }).catch((e) => e);
    const missing = await w.update.execute({ id: 'inconnu', version: 1, role: 'OTHER', access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    for (const role of [RoleCode.Finance, RoleCode.Support]) {
      await expect(w.update.execute({ id: w.id, version: w.version, role: 'OTHER', access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(w.contacts.items[0].role).toBe('FINANCE_DIRECTOR');
  });
  it('entreprise archivée : contact non modifiable', async () => {
    const w = await setup();
    w.companies.items[0].archive();
    await expect(w.update.execute({ id: w.id, version: w.version, role: 'OTHER', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Contacts — suppression', () => {
  async function setup() {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    w.audit.length = 0;
    return { ...w, id: created.id };
  }
  it('le Responsable commercial supprime (suppression logique) ; le contact disparaît ; audit', async () => {
    const w = await setup();
    await w.remove.execute({ id: w.id, access: as(RoleCode.HeadOfSales, 'chef', ['am1']), actor });
    await expect(w.get.execute({ id: w.id, access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Delete, entityId: w.id });
  });
  it("le chargé de compte n'a pas le droit de supprimer ; un autre chef d'équipe non plus (introuvable)", async () => {
    const w = await setup();
    await expect(w.remove.execute({ id: w.id, access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.remove.execute({ id: w.id, access: as(RoleCode.HeadOfSales, 'autre', ['am2']), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await w.get.execute({ id: w.id, access: am1 })).toBeDefined();
  });
  it('un contact supprimé libère son nom (plus de doublon)', async () => {
    const w = await setup();
    await w.remove.execute({ id: w.id, access: as(RoleCode.HeadOfSales, 'chef', ['am1']), actor });
    await expect(w.register.execute({ companyId: 'c1', ...base, access: am1, actor })).resolves.toBeDefined();
  });
});

describe('Contacts — lecture et liste', () => {
  async function setup() {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2');
    await w.register.execute({ companyId: 'c1', lastName: 'Fotso', firstName: 'Alain', role: 'FINANCE_DIRECTOR', email: 'a@x.cm', access: am1, actor });
    await w.register.execute({ companyId: 'c1', lastName: 'Ndzana', firstName: 'Claire', role: 'DECISION_MAKER', access: am1, actor });
    await w.register.execute({ companyId: 'c2', lastName: 'Eto', firstName: 'Marc', access: as(RoleCode.AccountManager, 'am2'), actor });
    return w;
  }
  const list = (w: Awaited<ReturnType<typeof setup>>, access: AccessContext, extra: Record<string, unknown> = {}) =>
    w.list.execute({ page: 1, pageSize: 20, access, visibility: visibilityFor(access, 'bd.contact.read'), ...extra });
  it('chaque rôle ne voit que les contacts des entreprises de sa portée', async () => {
    const w = await setup();
    expect((await list(w, am1)).items.map((c) => c.lastName).sort()).toEqual(['Fotso', 'Ndzana']);
    expect((await list(w, as(RoleCode.AccountManager, 'am2'))).items.map((c) => c.lastName)).toEqual(['Eto']);
    expect((await list(w, as(RoleCode.HeadOfSales, 'chef', ['am1']))).items.map((c) => c.lastName).sort()).toEqual(['Fotso', 'Ndzana']);
    expect((await list(w, as(RoleCode.Direction, 'dir'))).total).toBe(3);
    expect((await list(w, as(RoleCode.Support, 'sup'))).total).toBe(3);
    expect((await list(w, as(RoleCode.Hr, 'rh'))).total).toBe(0);
  });
  it('filtres : recherche, fonction, entreprise ; la taille de page est bornée', async () => {
    const w = await setup();
    expect((await list(w, am1, { search: 'clair' })).items.map((c) => c.lastName)).toEqual(['Ndzana']);
    expect((await list(w, am1, { role: 'FINANCE_DIRECTOR' })).items.map((c) => c.lastName)).toEqual(['Fotso']);
    expect((await list(w, am1, { companyId: 'c1' })).total).toBe(2);
    expect((await list(w, am1, { pageSize: 5000 })).pageSize).toBe(100);
    expect((await list(w, am1, { role: 'INVENTE' })).total).toBe(2);
  });
  it("filtrer par l'entreprise d'un collègue : « introuvable », comme une entreprise inexistante", async () => {
    const w = await setup();
    const real = await list(w, am1, { companyId: 'c2' }).catch((e) => e);
    const missing = await list(w, am1, { companyId: 'inconnue' }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
  });
  it("la lecture d'un contact hors portée est « introuvable » ; Support et Direction lisent", async () => {
    const w = await setup();
    const id = w.contacts.items[2].id;
    await expect(w.get.execute({ id, access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id, access: as(RoleCode.Support, 'sup') })).resolves.toMatchObject({ lastName: 'Eto', companyName: 'Société c2' });
  });
});
