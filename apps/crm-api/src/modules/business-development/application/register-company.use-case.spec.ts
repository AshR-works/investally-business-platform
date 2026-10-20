import { ActorContext, DomainError, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { RegisterCompanyUseCase } from './register-company.use-case';

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

function build() {
  const companies = new InMemoryCompanies();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const useCase = new RegisterCompanyUseCase(
    companies,
    {
      record: async (r) => {
        audit.push(r);
      },
    },
    { run: (work) => work() },
    { now: () => new Date('2026-10-20T10:00:00Z') },
    { next: () => `id-${++seq}` },
  );
  return { useCase, companies, audit };
}

describe('RegisterCompanyUseCase', () => {
  it("enregistre l'entreprise et trace qui/quoi/d'où dans l'audit", async () => {
    const { useCase, companies, audit } = build();

    const view = await useCase.execute({ name: 'Acme SA', sector: 'Banque', actor });

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
    await useCase.execute({ name: 'Acme SA', actor });
    audit.length = 0;

    await expect(useCase.execute({ name: 'ACME sa', actor })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(audit).toHaveLength(0);
  });

  it('propage une erreur de validation du domaine', async () => {
    const { useCase } = build();
    await expect(useCase.execute({ name: '', actor })).rejects.toBeInstanceOf(DomainError);
  });
});
