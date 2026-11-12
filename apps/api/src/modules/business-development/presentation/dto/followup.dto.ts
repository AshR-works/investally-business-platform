import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const CHANNELS = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'OTHER'] as const;
const STATUSES = ['PLANNED', 'DONE', 'CANCELLED'] as const;
const DUES = ['overdue', 'today', 'upcoming'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Planification d'une relance : l'offre, l'échéance (AAAA-MM-JJ) et le canal ; la note est facultative. Tout autre champ est refusé. */
export class PlanFollowupDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  offerId!: string;

  @ApiProperty({ example: '2026-11-10' }) @IsString() @Matches(DATE, { message: "L'échéance doit être au format AAAA-MM-JJ" })
  dueOn!: string;

  @ApiProperty({ enum: CHANNELS }) @IsIn(CHANNELS)
  channel!: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Modification d'une relance à faire : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé). */
export class UpdateFollowupDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DATE, { message: "L'échéance doit être au format AAAA-MM-JJ" })
  dueOn?: string;

  @ApiPropertyOptional({ enum: CHANNELS }) @IsOptional() @IsIn(CHANNELS)
  channel?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Terminer ou annuler une relance : la version lue et le texte (résultat ou motif), obligatoire. */
export class CloseFollowupDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  text?: string;
}

/** Paramètres de la liste : pagination (taille ≤ 100), offre, état, échéance. */
export class ListFollowupsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Relances des offres de cette entreprise (navigation contextuelle depuis la fiche entreprise)" }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: DUES }) @IsOptional() @IsIn(DUES)
  due?: string;
}
