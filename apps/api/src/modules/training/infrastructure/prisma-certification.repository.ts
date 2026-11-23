import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { AmbassadorSuggestion } from '../domain/ambassador-suggestion';
import { Certification, CertificationKind, CertificationStatus } from '../domain/certification';
import { AmbassadorSuggestionRepository, CertificationRepository } from '../domain/certification-repositories';

const toCertification = (row: Prisma.CertificationGetPayload<object>): Certification =>
  Certification.rehydrate({
    id: row.id, enrollmentId: row.enrollmentId, kind: row.kind as CertificationKind, referenceNumber: row.referenceNumber, status: row.status as CertificationStatus,
    issuedByUserId: row.issuedByUserId, issuedAt: row.issuedAt, revokedByUserId: row.revokedByUserId, revokedAt: row.revokedAt, revokeReason: row.revokeReason, version: row.version,
  });

/** Persistance PostgreSQL des certifications : au plus une par inscription (unicité garantie par la base), numéros via une séquence. */
@Injectable()
export class PrismaCertificationRepository implements CertificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(certification: Certification): Promise<void> {
    try {
      const updated = await this.prisma.db.certification.updateMany({
        where: { id: certification.id },
        data: { status: certification.status, revokedByUserId: certification.revokedByUserId, revokedAt: certification.revokedAt, revokeReason: certification.revokeReason, version: { increment: 1 } },
      });
      if (updated.count === 1) return;
      await this.prisma.db.certification.create({
        data: {
          id: certification.id, enrollmentId: certification.enrollmentId, kind: certification.kind, referenceNumber: certification.referenceNumber, status: certification.status,
          issuedByUserId: certification.issuedByUserId, issuedAt: certification.issuedAt, version: certification.version,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une délivrance est déjà enregistrée pour cette inscription : rechargez la page');
      throw e;
    }
  }

  async find(enrollmentId: string): Promise<Certification | null> {
    const row = await this.prisma.db.certification.findUnique({ where: { enrollmentId } });
    return row ? toCertification(row) : null;
  }

  async bySession(enrollmentIds: readonly string[]): Promise<Certification[]> {
    if (enrollmentIds.length === 0) return [];
    const rows = await this.prisma.db.certification.findMany({ where: { enrollmentId: { in: [...enrollmentIds] } } });
    return rows.map(toCertification);
  }

  async nextReferenceNumber(): Promise<string> {
    const rows = await this.prisma.db.$queryRaw<{ n: bigint }[]>`SELECT nextval('training.certification_reference_seq') AS n`;
    const n = rows[0]!.n;
    return `CERT-${new Date().getUTCFullYear()}-${n.toString().padStart(6, '0')}`;
  }
}

const toSuggestion = (row: Prisma.AmbassadorSuggestionGetPayload<object>): AmbassadorSuggestion =>
  AmbassadorSuggestion.rehydrate({ id: row.id, enrollmentId: row.enrollmentId, learnerId: row.learnerId, companyId: row.companyId, ownerUserId: row.ownerUserId, createdAt: row.createdAt });

/** Persistance PostgreSQL des suggestions d'ambassadeur : au plus une par inscription. */
@Injectable()
export class PrismaAmbassadorSuggestionRepository implements AmbassadorSuggestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(suggestion: AmbassadorSuggestion): Promise<void> {
    await this.prisma.db.ambassadorSuggestion.create({
      data: { id: suggestion.id, enrollmentId: suggestion.enrollmentId, learnerId: suggestion.learnerId, companyId: suggestion.companyId, ownerUserId: suggestion.ownerUserId, createdAt: suggestion.createdAt },
    });
  }

  async forOwners(ownerUserIds: readonly string[] | 'all'): Promise<AmbassadorSuggestion[]> {
    const where = ownerUserIds === 'all' ? {} : { ownerUserId: { in: [...ownerUserIds] } };
    const rows = await this.prisma.db.ambassadorSuggestion.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map(toSuggestion);
  }
}
