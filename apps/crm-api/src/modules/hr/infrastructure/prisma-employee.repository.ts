import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Employee, EmployeeStatus } from '../domain/employee';
import { EmployeeListQuery, EmployeeRepository } from '../domain/employee-repository';

type EmployeeRow = Prisma.EmployeeGetPayload<object>;

const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

function toDomain(row: EmployeeRow): Employee {
  return Employee.rehydrate({
    id: row.id,
    matricule: row.matricule,
    lastName: row.lastName,
    firstName: row.firstName,
    jobTitle: row.jobTitle,
    department: row.department,
    managerEmployeeId: row.managerEmployeeId,
    userId: row.userId,
    workEmail: row.workEmail,
    workPhone: row.workPhone,
    hiredOn: day(row.hiredOn)!,
    leftOn: day(row.leftOn),
    status: row.status as EmployeeStatus,
    archivedAt: row.archivedAt,
    archiveReason: row.archiveReason,
    createdAt: row.createdAt,
    version: row.version,
  });
}

const searchWhere = (search: string | undefined): Prisma.EmployeeWhereInput =>
  search
    ? {
        OR: [
          { lastName: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
          { workEmail: { contains: search, mode: 'insensitive' } },
          { matricule: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

const ORDER: Prisma.EmployeeOrderByWithRelationInput[] = [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }];

/** Persistance PostgreSQL des employés (jamais supprimés : l'archivage est réversible). */
@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour l'employé ; une modification sur une version périmée est un conflit (verrou optimiste). Un matricule, un e-mail
   * professionnel ou un compte déjà pris est refusé par la base (index uniques) et devient un conflit lisible.
   */
  async save(employee: Employee): Promise<void> {
    const data = {
      matricule: employee.matricule,
      lastName: employee.lastName,
      firstName: employee.firstName,
      jobTitle: employee.jobTitle,
      department: employee.department,
      managerEmployeeId: employee.managerEmployeeId,
      userId: employee.userId,
      workEmail: employee.workEmail,
      workPhone: employee.workPhone,
      hiredOn: new Date(`${employee.hiredOn}T00:00:00Z`),
      leftOn: employee.leftOn ? new Date(`${employee.leftOn}T00:00:00Z`) : null,
      status: employee.status,
      archivedAt: employee.archivedAt,
      archiveReason: employee.archiveReason,
    };
    try {
      const updated = await this.prisma.db.employee.updateMany({ where: { id: employee.id, version: employee.version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count === 1) return;
      if ((await this.prisma.db.employee.count({ where: { id: employee.id } })) > 0) {
        throw new DomainError('CONFLICT', "L'employé a été modifié par un autre utilisateur : rechargez-le avant de le modifier");
      }
      await this.prisma.db.employee.create({ data: { id: employee.id, ...data, version: employee.version, createdAt: employee.createdAt } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Un employé porte déjà ce matricule, cette adresse e-mail professionnelle ou ce compte');
      }
      throw e;
    }
  }

  async findById(id: string): Promise<Employee | null> {
    const row = await this.prisma.db.employee.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Employee[]> {
    if (ids.length === 0) return [];
    return (await this.prisma.db.employee.findMany({ where: { id: { in: [...ids] } } })).map(toDomain);
  }

  async findByMatricule(matricule: string, excludeId?: string): Promise<Employee | null> {
    const row = await this.prisma.db.employee.findFirst({ where: { matricule: { equals: matricule, mode: 'insensitive' }, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    return row ? toDomain(row) : null;
  }

  async findByWorkEmail(emailKey: string, excludeId?: string): Promise<Employee | null> {
    const row = await this.prisma.db.employee.findFirst({ where: { workEmail: { equals: emailKey, mode: 'insensitive' }, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string, excludeId?: string): Promise<Employee | null> {
    const row = await this.prisma.db.employee.findFirst({ where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    return row ? toDomain(row) : null;
  }

  async list(query: EmployeeListQuery): Promise<Page<Employee>> {
    const where: Prisma.EmployeeWhereInput = {
      ...(query.userIds ? { userId: { in: [...query.userIds] } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { department: { equals: query.department, mode: 'insensitive' } } : {}),
      ...searchWhere(query.search),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.employee.findMany({ where, orderBy: ORDER, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.employee.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }

  async listActive(query: { search?: string; department?: string; page?: number; pageSize?: number }): Promise<Page<Employee>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.EmployeeWhereInput = {
      status: 'ACTIVE',
      ...(query.department ? { department: { equals: query.department, mode: 'insensitive' } } : {}),
      ...searchWhere(query.search),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.employee.findMany({ where, orderBy: ORDER, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.db.employee.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page, pageSize };
  }

  async allActive(limit: number): Promise<Employee[]> {
    return (await this.prisma.db.employee.findMany({ where: { status: 'ACTIVE' }, orderBy: ORDER, take: limit })).map(toDomain);
  }
}
