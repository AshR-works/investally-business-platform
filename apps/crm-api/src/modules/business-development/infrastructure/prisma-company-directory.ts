import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { ApprovalRef, CompanyDirectory, CompanyRef } from '../application/company-directory';

const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

const approvalOf = (r: Prisma.ApprovalGetPayload<object>): ApprovalRef => ({
  id: r.id,
  companyId: r.companyId,
  status: r.status,
  amount: r.amount === null ? null : r.amount.toFixed(2),
  places: r.places,
  currency: r.currency,
  validUntil: day(r.validUntil),
  receivedOn: day(r.receivedOn),
  payerName: r.payerName,
});

/** Lecture seule des entreprises, contacts et agréments pour le module Formation. */
@Injectable()
export class PrismaCompanyDirectory implements CompanyDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async company(id: string): Promise<CompanyRef | null> {
    const row = await this.prisma.db.company.findUnique({ where: { id }, select: { id: true, name: true, ownerUserId: true, status: true } });
    return row ? { id: row.id, name: row.name, ownerUserId: row.ownerUserId, archived: row.status === 'ARCHIVED' } : null;
  }

  async companyIdsOwnedBy(ownerIds: readonly string[]): Promise<string[]> {
    if (ownerIds.length === 0) return [];
    const rows = await this.prisma.db.company.findMany({ where: { ownerUserId: { in: [...ownerIds] } }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async contactBelongsTo(contactId: string, companyId: string): Promise<boolean> {
    return (await this.prisma.db.contact.count({ where: { id: contactId, companyId, deletedAt: null } })) > 0;
  }

  async approval(id: string): Promise<ApprovalRef | null> {
    const row = await this.prisma.db.approval.findUnique({ where: { id } });
    return row ? approvalOf(row) : null;
  }

  async approvalsOf(companyId: string): Promise<ApprovalRef[]> {
    const rows = await this.prisma.db.approval.findMany({ where: { companyId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    return rows.map(approvalOf);
  }

  async lockApproval(id: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM bd.approvals WHERE id = ${id}::uuid FOR UPDATE`;
  }
}
