import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Contract, ContractEndReason, ContractStatus, ContractType } from '../domain/contract';
import { ContractListQuery, ContractRepository, ContractTypeRepository } from '../domain/contract-repositories';

const day = (value: Date): string => value.toISOString().slice(0, 10);
const dayOrNull = (value: Date | null): string | null => (value ? day(value) : null);
const date = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const dateOrNull = (iso: string | null): Date | null => (iso ? date(iso) : null);

function toContract(row: Prisma.ContractGetPayload<object>): Contract {
  return Contract.rehydrate({
    id: row.id, employeeId: row.employeeId, contractTypeId: row.contractTypeId, start: day(row.startDate), end: dayOrNull(row.endDate), probationEnd: dayOrNull(row.probationEndDate),
    status: row.status as ContractStatus, endedOn: dayOrNull(row.endedOn), endReason: row.endReason as ContractEndReason | null, version: row.version, createdAt: row.createdAt,
  });
}

/** Persistance PostgreSQL des contrats (jamais supprimés : on les termine). */
@Injectable()
export class PrismaContractRepository implements ContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(contract: Contract): Promise<void> {
    const data = {
      employeeId: contract.employeeId, contractTypeId: contract.contractTypeId, startDate: date(contract.start), endDate: dateOrNull(contract.end), probationEndDate: dateOrNull(contract.probationEnd),
      status: contract.status, endedOn: dateOrNull(contract.endedOn), endReason: contract.endReason,
    };
    try {
      const updated = await this.prisma.db.contract.updateMany({ where: { id: contract.id, version: contract.version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count === 1) return;
      if ((await this.prisma.db.contract.count({ where: { id: contract.id } })) > 0) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');
      await this.prisma.db.contract.create({ data: { id: contract.id, ...data, version: contract.version, createdAt: contract.createdAt } });
    } catch (e) {
      // Index unique partiel : un second contrat en cours pour le même employé.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Un contrat est déjà en cours pour cet employé');
      throw e;
    }
  }

  async findById(id: string): Promise<Contract | null> {
    const row = await this.prisma.db.contract.findUnique({ where: { id } });
    return row ? toContract(row) : null;
  }

  async ofEmployee(employeeId: string): Promise<Contract[]> {
    const rows = await this.prisma.db.contract.findMany({ where: { employeeId }, orderBy: [{ startDate: 'desc' }, { id: 'asc' }] });
    return rows.map(toContract);
  }

  async list(query: ContractListQuery): Promise<Page<Contract>> {
    const where: Prisma.ContractWhereInput = {
      ...(query.employeeIds ? { employeeId: { in: [...query.employeeIds] } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.contract.findMany({ where, orderBy: [{ startDate: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.contract.count({ where }),
    ]);
    return { items: rows.map(toContract), total, page: query.page, pageSize: query.pageSize };
  }

  async deadlines(from: string, to: string): Promise<Contract[]> {
    const rows = await this.prisma.db.contract.findMany({
      where: { status: 'ACTIVE', OR: [{ endDate: { gte: date(from), lte: date(to) } }, { probationEndDate: { gte: date(from), lte: date(to) } }] },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toContract);
  }

  /** Verrou de ligne : la seconde création attend la fin de la première, puis voit son résultat. Sans transaction, le verrou se libère aussitôt. */
  async lockEmployee(employeeId: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM hr.employees WHERE id = ${employeeId}::uuid FOR UPDATE`;
  }
}

/** Persistance des types de contrat. */
@Injectable()
export class PrismaContractTypeRepository implements ContractTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toType(row: Prisma.ContractTypeGetPayload<object>): ContractType {
    return ContractType.rehydrate({ id: row.id, code: row.code, label: row.label, fixedTerm: row.fixedTerm, active: row.active, sortOrder: row.sortOrder, version: row.version, createdAt: row.createdAt });
  }

  async types(includeInactive: boolean): Promise<ContractType[]> {
    const rows = await this.prisma.db.contractType.findMany({ where: includeInactive ? {} : { active: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
    return rows.map((row) => this.toType(row));
  }

  async findType(id: string): Promise<ContractType | null> {
    const row = await this.prisma.db.contractType.findUnique({ where: { id } });
    return row ? this.toType(row) : null;
  }

  async findTypeByCode(code: string): Promise<ContractType | null> {
    const row = await this.prisma.db.contractType.findUnique({ where: { code } });
    return row ? this.toType(row) : null;
  }

  async findTypes(ids: readonly string[]): Promise<ContractType[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.db.contractType.findMany({ where: { id: { in: [...ids] } } });
    return rows.map((row) => this.toType(row));
  }

  async saveType(type: ContractType): Promise<void> {
    const data = { label: type.label, active: type.active, sortOrder: type.sortOrder };
    try {
      const updated = await this.prisma.db.contractType.updateMany({ where: { id: type.id, version: type.version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count === 1) return;
      if ((await this.prisma.db.contractType.count({ where: { id: type.id } })) > 0) throw new DomainError('CONFLICT', 'Le type de contrat a été modifié par un autre utilisateur : rechargez-le');
      await this.prisma.db.contractType.create({ data: { id: type.id, code: type.code, fixedTerm: type.fixedTerm, ...data, version: type.version, createdAt: type.createdAt } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', `Le code ${type.code} existe déjà`);
      throw e;
    }
  }
}
