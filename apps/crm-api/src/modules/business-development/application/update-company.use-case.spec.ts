import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { InMemoryFacilitators } from '../../../../test/support/in-memory-facilitators';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { FacilitationResolver } from './facilitation-resolver';
import { RegisterCompanyUseCase } from './register-company.use-case';
import { RegisterFacilitatorUseCase } from './register-facilitator.use-case';
import { UpdateCompanyUseCase } from './update-company.use-case';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) {
    if (!this.items.includes(company)) this.items.push(company);
  }
  async findById(id: string) {
    return this.items.find((c) => c.id === id) ?? null;
  }
  async existsByName(name: CompanyName) {
    return this.items.some((c) => c.name.normalized === name.normalized);
  }
  async list(): Promise<Page<Company>> {
    return { items: this.items, total: this.items.length, page: 1, pageSize: 20 };
  }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const newFacilitator = { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 6 99 00 11 22', comment: 'Ancien collègue du DAF' };

function build() {
  const companies = new InMemoryCompanies();
  const facilitators = new InMemoryFacilitators();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const clock = { now: () => new Date('2026-10-30T10:00:00Z') };
  const ids = { next: () => `id-${++seq}` };
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const resolver = new FacilitationResolver(facilitators, new RegisterFacilitatorUseCase(facilitators, recorder, unitOfWork, clock, ids));
  const register = new RegisterCompanyUseCase(companies, resolver, recorder, unitOfWork, clock, ids);
  const update = new UpdateCompanyUseCase(companies, facilitators, resolver, recorder, unitOfWork);
  return { companies, facilitators, audit, register, update };
}

/** Une entreprise de « am1 » (chargé de compte), avec ou sans facilitateur. */
async function setup(withFacilitation = false) {
  const w = build();
  const am1 = as(RoleCode.AccountManager, 'am1');
  const created = await w.register.execute({
    name: 'Acme', ownerUserId: 'am1', sector: 'Banque', phone: '+237 222 33 44 55', access: am1, actor,
    ...(withFacilitation ? { facilitation: { newFacilitator, contactMethod: 'PHONE_CALL', isCompanyEmployee: true } } : {}),
  });
  w.audit.length = 0;
  return { ...w, id: created.id, version: created.version, am1 };
}

describe('UpdateCompanyUseCase — modifier une fiche', () => {
  it("modifie les champs donnés, laisse les autres, et trace l'ancienne et la nouvelle valeur dans l'audit", async () => {
    const { update, id, version, am1, audit } = await setup();
    const view = await update.execute({ id, version, sector: 'Assurance', country: 'Cameroun', email: ' Contact@Acme.CM ', access: am1, actor });
    expect(view).toMatchObject({ name: 'Acme', sector: 'Assurance', country: 'Cameroun', email: 'contact@acme.cm', phone: '+237 222 33 44 55' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: AuditAction.Update, entityType: 'Company', entityId: id, oldValue: { sector: 'Banque', country: null }, newValue: { sector: 'Assurance', country: 'Cameroun' } });
  });

  it('une chaîne vide efface un champ facultatif ; absent = inchangé', async () => {
    const { update, id, version, am1 } = await setup();
    const view = await update.execute({ id, version, phone: '', access: am1, actor });
    expect(view).toMatchObject({ phone: null, sector: 'Banque' });
  });

  it('numéro de version périmé : conflit, et rien n\'est modifié ni tracé', async () => {
    const { update, id, version, am1, audit, companies } = await setup();
    await expect(update.execute({ id, version: version + 1, sector: 'X', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(companies.items[0].sector).toBe('Banque');
    expect(audit).toHaveLength(0);
  });

  it('un nom déjà pris par une AUTRE entreprise est un conflit ; changer la casse de son propre nom est permis', async () => {
    const { update, register, id, version, am1 } = await setup();
    await register.execute({ name: 'Beta', ownerUserId: 'am1', access: am1, actor });
    await expect(update.execute({ id, version, name: 'BETA', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(update.execute({ id, version, name: 'ACME', access: am1, actor })).resolves.toMatchObject({ name: 'ACME' });
  });

  it('une validation qui échoue ne laisse aucune modification partielle', async () => {
    const { update, id, version, am1, companies } = await setup();
    await expect(update.execute({ id, version, sector: 'Assurance', email: 'pas-un-mail', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(companies.items[0].sector).toBe('Banque');
  });

  it("IDOR : l'entreprise d'un collègue est « introuvable », comme un identifiant inexistant, et rien n'est modifié", async () => {
    const { update, id, version, companies, audit } = await setup();
    const am2 = as(RoleCode.AccountManager, 'am2');
    const real = await update.execute({ id, version, sector: 'Piège', access: am2, actor }).catch((e) => e);
    const missing = await update.execute({ id: 'inconnue', version, sector: 'Piège', access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(companies.items[0].sector).toBe('Banque');
    expect(audit).toHaveLength(0);
  });

  it("le Responsable commercial modifie l'entreprise d'un subordonné direct (portée Équipe), pas celle d'un étranger à son équipe", async () => {
    const { update, id, version } = await setup();
    await expect(update.execute({ id, version, sector: 'Énergie', access: as(RoleCode.HeadOfSales, 'chef', ['am1']), actor })).resolves.toMatchObject({ sector: 'Énergie' });
    await expect(update.execute({ id, version, sector: 'X', access: as(RoleCode.HeadOfSales, 'autre-chef', ['am2']), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it("sans droit de modification (Finance, Support), l'entreprise reste « introuvable »", async () => {
    const { update, id, version } = await setup();
    for (const role of [RoleCode.Finance, RoleCode.Support, RoleCode.Direction]) {
      await expect(update.execute({ id, version, sector: 'X', access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('une entreprise archivée ne se modifie plus', async () => {
    const { update, id, version, am1, companies } = await setup();
    companies.items[0].archive();
    await expect(update.execute({ id, version, sector: 'X', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });

  describe('facilitateur et commission', () => {
    it('ajoute un facilitateur à une entreprise qui n\'en avait pas', async () => {
      const { update, id, version, am1, facilitators } = await setup();
      const view = await update.execute({ id, version, facilitation: { newFacilitator, contactMethod: 'WHATSAPP_MESSAGE' }, access: am1, actor });
      expect(facilitators.items).toHaveLength(1);
      expect(view.facilitation).toMatchObject({ contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: false, facilitator: { lastName: 'Mbarga' } });
    });

    it('change la méthode et l\'appartenance sans changer de facilitateur (aucun nouveau facilitateur)', async () => {
      const { update, id, version, am1, facilitators } = await setup(true);
      const view = await update.execute({ id, version, facilitation: { contactMethod: 'EMAIL', isCompanyEmployee: false }, access: am1, actor });
      expect(facilitators.items).toHaveLength(1);
      expect(view.facilitation).toMatchObject({ contactMethod: 'EMAIL', isCompanyEmployee: false, facilitator: { lastName: 'Mbarga' } });
    });

    it('le Responsable commercial définit la commission ; une modification ultérieure du chargé de compte la CONSERVE', async () => {
      const { update, id, version, am1 } = await setup(true);
      const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
      const withCommission = await update.execute({ id, version, facilitation: { commission: { type: 'PERCENT', value: 7.5 } }, access: chef, actor });
      expect(withCommission.facilitation?.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });
      const edited = await update.execute({ id, version: withCommission.version, phone: '+237 600 00 00 09', facilitation: { contactMethod: 'MEETING' }, access: am1, actor });
      expect(edited.phone).toBe('+237 600 00 00 09');
      expect(edited.facilitation?.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });
    });

    it('le chargé de compte ne peut ni définir, ni modifier, ni retirer une commission', async () => {
      const { update, id, version, am1 } = await setup(true);
      await expect(update.execute({ id, version, facilitation: { commission: { type: 'PERCENT', value: 5 } }, access: am1, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
      const withCommission = await update.execute({ id, version, facilitation: { commission: { type: 'FIXED', value: 250000 } }, access: chef, actor });
      expect(withCommission.facilitation?.commission).toEqual({ type: 'FIXED', value: '250000.00', currency: 'XAF' });
      await expect(update.execute({ id, version: withCommission.version, facilitation: { commission: { type: 'PERCENT', value: 1 } }, access: am1, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(update.execute({ id, version: withCommission.version, facilitation: { commission: null }, access: am1, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(update.execute({ id, version: withCommission.version, facilitation: null, access: am1, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('le Responsable commercial peut retirer la commission, puis le facilitateur', async () => {
      const { update, id, version } = await setup(true);
      const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
      const a = await update.execute({ id, version, facilitation: { commission: { type: 'PERCENT', value: 5 } }, access: chef, actor });
      const b = await update.execute({ id, version: a.version, facilitation: { commission: null }, access: chef, actor });
      expect(b.facilitation?.commission).toBeNull();
      const c = await update.execute({ id, version: b.version, facilitation: null, access: chef, actor });
      expect(c.facilitation).toBeNull();
    });

    it('l\'audit garde l\'ancienne et la nouvelle commission, même invisibles pour l\'appelant', async () => {
      const { update, id, version, audit } = await setup(true);
      const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
      await update.execute({ id, version, facilitation: { commission: { type: 'PERCENT', value: 5 } }, access: chef, actor });
      expect(JSON.stringify(audit.at(-1)?.newValue)).toContain('"PERCENT"');
      expect(JSON.stringify(audit.at(-1)?.oldValue)).not.toContain('"PERCENT"');
    });

    it('remplacer par le facilitateur d\'un collègue : « introuvable », rien n\'est modifié', async () => {
      const { update, register, facilitators, id, version, am1, companies } = await setup(true);
      const am2 = as(RoleCode.AccountManager, 'am2');
      await register.execute({ name: 'Gamma', ownerUserId: 'am2', access: am2, actor, facilitation: { newFacilitator: { ...newFacilitator, lastName: 'Secret' }, contactMethod: 'EMAIL' } });
      const foreign = facilitators.items.find((f) => f.lastName === 'Secret')!.id;
      await expect(update.execute({ id, version, facilitation: { facilitatorId: foreign }, access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(companies.items.find((c) => c.id === id)?.facilitation?.facilitatorId).not.toBe(foreign);
    });

    it('une méthode inconnue est refusée avant toute création de facilitateur', async () => {
      const { update, id, version, am1, facilitators } = await setup();
      await expect(update.execute({ id, version, facilitation: { newFacilitator, contactMethod: 'PIGEON' }, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
      expect(facilitators.items).toHaveLength(0);
    });

    it('lier un facilitateur sans méthode de contact, quand il n\'y en avait pas, est refusé', async () => {
      const { update, id, version, am1 } = await setup();
      await expect(update.execute({ id, version, facilitation: { newFacilitator }, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });
});
