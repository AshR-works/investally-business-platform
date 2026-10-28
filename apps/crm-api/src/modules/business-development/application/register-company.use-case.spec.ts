import { ActorContext, DomainError, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { InMemoryFacilitators } from '../../../../test/support/in-memory-facilitators';
import { RegisterCompanyUseCase } from './register-company.use-case';
import { RegisterFacilitatorUseCase } from './register-facilitator.use-case';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) {
    this.items.push(company);
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
/** Droits réels d'un rôle (même matrice que le serveur), propriétaire = `u1`. */
const as = (role: RoleCode, actorId = 'u1'): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: [] });

function build() {
  const companies = new InMemoryCompanies();
  const facilitators = new InMemoryFacilitators();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const clock = { now: () => new Date('2026-10-20T10:00:00Z') };
  const ids = { next: () => `id-${++seq}` };
  const auditRecorder = {
    record: async (r: AuditRecord) => {
      audit.push(r);
    },
  };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const registerFacilitator = new RegisterFacilitatorUseCase(facilitators, auditRecorder, unitOfWork, clock, ids);
  const useCase = new RegisterCompanyUseCase(companies, facilitators, registerFacilitator, auditRecorder, unitOfWork, clock, ids);
  return { useCase, companies, facilitators, audit };
}

const newFacilitator = { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 6 99 00 11 22', comment: 'Ancien collègue du DAF' };

describe('RegisterCompanyUseCase', () => {
  it("enregistre l'entreprise et trace qui/quoi/d'où dans l'audit", async () => {
    const { useCase, companies, audit } = build();

    const view = await useCase.execute({ name: 'Acme SA', ownerUserId: 'u1', sector: 'Banque', actor });

    expect(view).toMatchObject({ id: 'id-1', name: 'Acme SA', status: 'TARGET', sector: 'Banque' });
    expect(companies.items).toHaveLength(1);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor,
      module: 'business-development',
      entityType: 'Company',
      entityId: 'id-1',
      action: AuditAction.Create,
      newValue: { name: 'Acme SA' },
    });
  });

  it("refuse un doublon (insensible à la casse) sans écrire d'audit", async () => {
    const { useCase, audit } = build();
    await useCase.execute({ name: 'Acme SA', ownerUserId: 'u1', actor });
    audit.length = 0;

    await expect(useCase.execute({ name: 'ACME sa', ownerUserId: 'u1', actor })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(audit).toHaveLength(0);
  });

  it('propage une erreur de validation du domaine', async () => {
    const { useCase } = build();
    await expect(useCase.execute({ name: '', ownerUserId: 'u1', actor })).rejects.toBeInstanceOf(DomainError);
  });

  describe('coordonnées', () => {
    it("normalise l'e-mail (minuscules) et le téléphone", async () => {
      const { useCase } = build();
      const view = await useCase.execute({ name: 'Acme', ownerUserId: 'u1', email: '  Contact@ACME.cm ', phone: '+237  222 33 44 55', actor });
      expect(view).toMatchObject({ email: 'contact@acme.cm', phone: '+237 222 33 44 55' });
    });
    it.each([['pas-un-mail'], ['a@b'], ['a b@c.d']])("refuse l'e-mail %s", async (email) => {
      const { useCase, companies } = build();
      await expect(useCase.execute({ name: 'Acme', ownerUserId: 'u1', email, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
      expect(companies.items).toHaveLength(0);
    });
    it.each([['abc'], ['12'], ['12 34 56 ; DROP']])('refuse le téléphone %s', async (phone) => {
      const { useCase } = build();
      await expect(useCase.execute({ name: 'Acme', ownerUserId: 'u1', phone, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });

  describe('facilitateur et commission', () => {
    it('crée un NOUVEAU facilitateur lié à l\'entreprise, avec méthode de contact, et audite les deux', async () => {
      const { useCase, facilitators, audit } = build();
      const view = await useCase.execute({
        name: 'Acme', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor,
        facilitation: { newFacilitator, contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: true },
      });
      expect(facilitators.items).toHaveLength(1);
      expect(view.facilitation).toMatchObject({
        contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: true,
        facilitator: { firstName: 'Paul', lastName: 'Mbarga', phone: '+237 6 99 00 11 22', comment: 'Ancien collègue du DAF' },
      });
      expect(audit.map((a) => a.entityType).sort()).toEqual(['Company', 'Facilitator']);
    });

    it('réutilise un facilitateur existant de sa portée', async () => {
      const { useCase, facilitators } = build();
      const first = await useCase.execute({ name: 'A', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor, facilitation: { newFacilitator, contactMethod: 'PHONE_CALL' } });
      const second = await useCase.execute({
        name: 'B', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor,
        facilitation: { facilitatorId: first.facilitation!.facilitatorId, contactMethod: 'EMAIL' },
      });
      expect(facilitators.items).toHaveLength(1);
      expect(second.facilitation?.facilitatorId).toBe(first.facilitation?.facilitatorId);
    });

    it("IDOR : le facilitateur d'un collègue est « introuvable », comme un identifiant inexistant", async () => {
      const { useCase, facilitators, companies } = build();
      await useCase.execute({ name: 'A', ownerUserId: 'u2', access: as(RoleCode.AccountManager, 'u2'), actor, facilitation: { newFacilitator, contactMethod: 'PHONE_CALL' } });
      const foreign = facilitators.items[0].id;
      const attempt = (facilitatorId: string) =>
        useCase.execute({ name: 'B', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor, facilitation: { facilitatorId, contactMethod: 'EMAIL' } });
      const real = await attempt(foreign).catch((e) => e);
      const missing = await attempt('inconnu').catch((e) => e);
      expect(real).toMatchObject({ code: 'NOT_FOUND' });
      expect(real.message).toBe(missing.message);
      expect(companies.items.map((c) => c.name.value)).toEqual(['A']);
    });

    it('un facilitateur existant ET un nouveau, ou aucun des deux : refusé', async () => {
      const { useCase } = build();
      const base = { name: 'Acme', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor };
      await expect(useCase.execute({ ...base, facilitation: { contactMethod: 'EMAIL' } })).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(useCase.execute({ ...base, facilitation: { facilitatorId: 'x', newFacilitator, contactMethod: 'EMAIL' } })).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('refuse une méthode de contact inconnue et un facilitateur sans téléphone ni nom', async () => {
      const { useCase, facilitators } = build();
      const base = { name: 'Acme', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor };
      await expect(useCase.execute({ ...base, facilitation: { newFacilitator, contactMethod: 'PIGEON' } })).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(useCase.execute({ ...base, facilitation: { newFacilitator: { ...newFacilitator, phone: '' }, contactMethod: 'EMAIL' } })).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(useCase.execute({ ...base, facilitation: { newFacilitator: { ...newFacilitator, lastName: ' ' }, contactMethod: 'EMAIL' } })).rejects.toMatchObject({ code: 'VALIDATION' });
      expect(facilitators.items).toHaveLength(0);
    });

    it('sans droit de créer un facilitateur (Support) : refusé', async () => {
      const { useCase } = build();
      await expect(
        useCase.execute({ name: 'Acme', ownerUserId: 'u1', access: as(RoleCode.Support), actor, facilitation: { newFacilitator, contactMethod: 'EMAIL' } }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('facilitateur fourni sans droits de l\'appelant : refusé (jamais de repli permissif)', async () => {
      const { useCase } = build();
      await expect(
        useCase.execute({ name: 'Acme', ownerUserId: 'u1', actor, facilitation: { newFacilitator, contactMethod: 'EMAIL' } }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    describe('commission', () => {
      const withCommission = (commission: { type: string; value: string | number; currency?: string }, role = RoleCode.HeadOfSales) =>
        build().useCase.execute({
          name: 'Acme', ownerUserId: 'u1', access: as(role), actor,
          facilitation: { newFacilitator, contactMethod: 'PHONE_CALL', commission },
        });

      it('montant fixe avec devise, ramené à deux décimales ; visible de qui détient la permission', async () => {
        const view = await withCommission({ type: 'FIXED', value: '1500,5', currency: 'xaf' });
        expect(view.facilitation?.commission).toEqual({ type: 'FIXED', value: '1500.50', currency: 'XAF' });
      });
      it('pourcentage sans devise', async () => {
        const view = await withCommission({ type: 'PERCENT', value: 7.5 });
        expect(view.facilitation?.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });
      });
      it.each([
        [{ type: 'PERCENT', value: 0 }], [{ type: 'PERCENT', value: 100.01 }], [{ type: 'PERCENT', value: 5, currency: 'XAF' }],
        [{ type: 'FIXED', value: 100 }], [{ type: 'FIXED', value: 100, currency: 'FCFA' }], [{ type: 'FIXED', value: -5, currency: 'XAF' }],
        [{ type: 'FIXED', value: 'abc', currency: 'XAF' }], [{ type: 'FIXED', value: '1.234', currency: 'XAF' }], [{ type: 'AUTRE', value: 5, currency: 'XAF' }],
      ])('refuse la commission invalide %j', async (commission) => {
        await expect(withCommission(commission)).rejects.toMatchObject({ code: 'VALIDATION' });
      });
      it('le chargé de compte ne peut PAS définir une commission (il voit le facilitateur, pas le montant)', async () => {
        await expect(withCommission({ type: 'PERCENT', value: 5 }, RoleCode.AccountManager)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      });
      it("sans la permission « Commissions », la réponse ne contient aucune commission (pas même une clé vide)", async () => {
        const { useCase } = build();
        const view = await useCase.execute({
          name: 'Acme', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor,
          facilitation: { newFacilitator, contactMethod: 'EMAIL' },
        });
        expect(view.facilitation).not.toHaveProperty('commission');
      });
      it("l'audit garde la commission même quand l'appelant ne peut pas la relire", async () => {
        const { useCase, audit } = build();
        await useCase.execute({
          name: 'Acme', ownerUserId: 'u1', access: as(RoleCode.HeadOfSales), actor,
          facilitation: { newFacilitator, contactMethod: 'EMAIL', commission: { type: 'PERCENT', value: 5 } },
        });
        const company = audit.find((a) => a.entityType === 'Company')!;
        expect(JSON.stringify(company.newValue)).toContain('"PERCENT"');
      });
    });

    it("doublon de nom : refusé AVANT toute écriture, aucun facilitateur n'est créé", async () => {
      const { useCase, facilitators } = build();
      await useCase.execute({ name: 'Acme', ownerUserId: 'u1', actor });
      await expect(
        useCase.execute({ name: 'ACME', ownerUserId: 'u1', access: as(RoleCode.AccountManager), actor, facilitation: { newFacilitator, contactMethod: 'EMAIL' } }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(facilitators.items).toHaveLength(0);
    });
  });
});
