import 'reflect-metadata';
import { PrismaService } from '../src/platform/prisma.service';
import { SystemClock } from '../src/platform/system-clock';
import { UuidV7Generator } from '../src/platform/uuid-v7-generator';
import { DefaultAuditRecorder } from '../src/modules/audit/application/audit-recorder';
import { PrismaAuditRepository } from '../src/modules/audit/infrastructure/prisma-audit.repository';
import { RegisterCompanyUseCase } from '../src/modules/business-development/application/register-company.use-case';
import { PrismaCompanyRepository } from '../src/modules/business-development/infrastructure/prisma-company.repository';

/**
 * Nécessite une base PostgreSQL migrée (DATABASE_URL). Ignoré sinon.
 * ATTENTION : écrit dans la base ciblée -> utiliser une base de test dédiée.
 */
const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('RegisterCompany (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const clock = new SystemClock();
  const ids = new UuidV7Generator();
  const auditRepo = new PrismaAuditRepository(prisma);
  const useCase = new RegisterCompanyUseCase(
    new PrismaCompanyRepository(prisma),
    new DefaultAuditRecorder(auditRepo, clock, ids),
    prisma,
    clock,
    ids,
  );
  const actor = { userId: null, sessionId: null, ipAddress: '127.0.0.1', device: 'integration-test' };
  const unique = `Acme-${Date.now()}`;

  afterAll(() => prisma.onModuleDestroy());

  it('persiste l\'entreprise et écrit l\'audit dans la même transaction', async () => {
    const view = await useCase.execute({ name: unique, sector: 'Banque', actor });

    const trail = await auditRepo.listByEntity('Company', view.id);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ action: 'CREATE', module: 'business-development' });
    expect(trail[0].actor.ipAddress).toBe('127.0.0.1');
  });

  it('refuse un doublon', async () => {
    await expect(useCase.execute({ name: unique.toUpperCase(), actor })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('annule l\'entreprise si l\'audit échoue (atomicité)', async () => {
    const failing = new RegisterCompanyUseCase(
      new PrismaCompanyRepository(prisma),
      { record: async () => { throw new Error('audit indisponible'); } },
      prisma,
      clock,
      ids,
    );
    const name = `Rollback-${Date.now()}`;
    await expect(failing.execute({ name, actor })).rejects.toThrow('audit indisponible');
    expect(await new PrismaCompanyRepository(prisma).list({ page: 1, pageSize: 5, search: name }))
      .toMatchObject({ total: 0 });
  });

  it('enregistre les horodatages en UTC, quel que soit le fuseau du serveur', async () => {
    const before = Date.now();
    const view = await useCase.execute({ name: `Utc-${Date.now()}`, actor });
    const [row] = await prisma.db.$queryRaw<{ company_ms: number; audit_ms: number }[]>`
      SELECT (extract(epoch FROM c.created_at) * 1000)::float8 AS company_ms,
             (extract(epoch FROM a.created_at) * 1000)::float8 AS audit_ms
      FROM bd.companies c JOIN audit.audit_logs a ON a.entity_id = c.id::text
      WHERE c.id = ${view.id}::uuid`;
    // L'écart avec l'horloge réelle doit rester de l'ordre de la seconde, pas de l'heure.
    expect(Math.abs(row.company_ms - before)).toBeLessThan(5_000);
    expect(Math.abs(row.audit_ms - before)).toBeLessThan(5_000);
  });

  it('le journal d\'audit est en ajout seul (UPDATE refusé par la base)', async () => {
    await expect(prisma.db.$executeRaw`UPDATE audit.audit_logs SET module = 'x'`).rejects.toThrow(/append-only/);
  });
});
