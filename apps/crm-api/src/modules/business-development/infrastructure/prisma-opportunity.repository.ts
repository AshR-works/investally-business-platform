import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { LossReason, Opportunity, OpportunitySource, OpportunityStage, OpportunityStatus } from '../domain/opportunity';
import { DecisionMakerMeetings, OpportunityListItem, OpportunityListQuery, OpportunityRepository } from '../domain/opportunity-repository';

type OpportunityRow = Prisma.OpportunityGetPayload<object>;

function toDomain(row: OpportunityRow): Opportunity {
  return Opportunity.rehydrate({
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    source: row.source as OpportunitySource,
    stage: row.stage as OpportunityStage,
    status: row.status as OpportunityStatus,
    lossReason: row.lossReason as LossReason | null,
    closingNote: row.closingNote,
    closedAt: row.closedAt,
    waiverReason: row.waiverReason,
    waivedAt: row.waivedAt,
    stageChangedAt: row.stageChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des opportunités (jamais supprimées : on les clôt, gagnées ou perdues). */
@Injectable()
export class PrismaOpportunityRepository implements OpportunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée ou met à jour l'opportunité ; une modification sur une version périmée est un conflit (verrou optimiste). */
  async save(opportunity: Opportunity): Promise<void> {
    const data = {
      companyId: opportunity.companyId,
      title: opportunity.title,
      amount: opportunity.amount,
      currency: opportunity.currency,
      source: opportunity.source,
      stage: opportunity.stage,
      status: opportunity.status,
      lossReason: opportunity.lossReason,
      closingNote: opportunity.closingNote,
      closedAt: opportunity.closedAt,
      waiverReason: opportunity.waiverReason,
      waivedAt: opportunity.waivedAt,
      stageChangedAt: opportunity.stageChangedAt,
    };
    const updated = await this.prisma.db.opportunity.updateMany({
      where: { id: opportunity.id, version: opportunity.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.opportunity.count({ where: { id: opportunity.id } })) > 0) {
      throw new DomainError('CONFLICT', "L'opportunité a été modifiée par un autre utilisateur : rechargez-la avant de la modifier");
    }
    await this.prisma.db.opportunity.create({ data: { id: opportunity.id, ...data, version: opportunity.version, createdAt: opportunity.createdAt } });
  }

  async findById(id: string): Promise<Opportunity | null> {
    const row = await this.prisma.db.opportunity.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(query: OpportunityListQuery): Promise<Page<OpportunityListItem>> {
    const where: Prisma.OpportunityWhereInput = {
      company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.opportunity.findMany({
        where,
        include: { company: { select: { name: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.opportunity.count({ where }),
    ]);
    return { items: rows.map((r) => ({ opportunity: toDomain(r), companyName: r.company.name })), total, page: query.page, pageSize: query.pageSize };
  }
}

/** Les rendez-vous « décideur » tenus d'une entreprise (agenda, S4.2d) : la règle de l'accord de principe les compte. */
@Injectable()
export class PrismaDecisionMakerMeetings implements DecisionMakerMeetings {
  constructor(private readonly prisma: PrismaService) {}

  async hasHeld(companyId: string, opportunityId: string): Promise<boolean> {
    const where: Prisma.AppointmentWhereInput = { companyId, type: 'DECISION_MAKER', status: 'HELD', OR: [{ opportunityId }, { opportunityId: null }] };
    return (await this.prisma.db.appointment.count({ where })) > 0;
  }
}
