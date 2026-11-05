import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const STATUSES = ['DUE', 'ON_HOLD', 'RELEASED', 'PAID', 'CANCELLED'] as const;

/** Débloquer les fonds : la version lue. */
export class ReleasePayoutDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

/** Mettre en attente ou annuler : la version lue et le motif (obligatoire, vérifié par le domaine). */
export class PayoutReasonDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Constater le versement : la version lue et la date du versement (jamais dans le futur ; le justificatif doit être déposé). */
export class PayPayoutDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ example: '2026-11-10' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de versement doit être au format AAAA-MM-JJ' })
  paidOn!: string;
}

/** Fixer le montant d'une commission en pourcentage dont l'agrément n'avait pas de montant (une seule fois). */
export class FixPayoutAmountDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ example: '250000' }) @IsString() @MaxLength(30)
  amount!: string;
}

/** Liste des versements : pagination (taille ≤ 100), état, entreprise, facilitateur. */
export class ListPayoutsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 50;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  facilitatorId?: string;
}
