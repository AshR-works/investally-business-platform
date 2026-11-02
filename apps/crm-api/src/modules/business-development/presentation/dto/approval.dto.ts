import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const STATUSES = ['RECEIVED', 'HONORED', 'EXPIRED', 'CANCELLED'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Enregistrement d'un agrément : l'opportunité, la date de réception, le montant couvert et/ou le nombre de places (au moins l'un
 * des deux, vérifié par le domaine), la devise et la fin de validité (facultative). Tout autre champ est refusé.
 */
export class RegisterApprovalDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  opportunityId!: string;

  @ApiPropertyOptional({ example: '12500000', description: 'Somme globale couverte (positive, deux décimales au plus)' }) @IsOptional() @IsString() @MaxLength(30)
  amount?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100000 }) @IsOptional() @IsInt() @Min(1) @Max(100000)
  places?: number;

  @ApiPropertyOptional({ example: 'XAF', default: 'XAF' }) @IsOptional() @IsString() @MaxLength(5)
  currency?: string;

  @ApiProperty({ example: '2026-11-03' }) @IsString() @Matches(DATE, { message: 'La date de réception doit être au format AAAA-MM-JJ' })
  receivedOn!: string;

  @ApiPropertyOptional({ example: '2027-03-31' }) @IsOptional() @IsString() @Matches(DATE, { message: 'La fin de validité doit être au format AAAA-MM-JJ' })
  validUntil?: string;
}

/** Honorer un agrément : la version lue. */
export class HonorApprovalDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

/** Déclarer un agrément expiré ou l'annuler : la version lue et le motif (obligatoire, vérifié par le domaine). */
export class CloseApprovalDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Liste des agréments : pagination (taille ≤ 100), entreprise, opportunité, état. */
export class ListApprovalsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 50;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: string;
}
