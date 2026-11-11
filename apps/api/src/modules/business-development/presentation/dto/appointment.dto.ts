import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const TYPES = ['FINANCE_DIRECTOR', 'DECISION_MAKER', 'VISIT'] as const;
const STATUSES = ['PLANNED', 'HELD', 'CANCELLED'] as const;
const ISO = { message: "La date doit être au format ISO 8601 (AAAA-MM-JJThh:mm:ssZ)" };

/** Planification d'un rendez-vous : le type, l'entreprise et l'heure de début ; le reste est facultatif. Tout autre champ est refusé. */
export class PlanAppointmentDto {
  @ApiProperty({ enum: TYPES }) @IsIn(TYPES)
  type!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: "Opportunité servie par le rendez-vous (même entreprise, ouverte)" }) @IsOptional() @IsUUID()
  opportunityId?: string;

  @ApiProperty({ example: '2026-11-10T09:00:00Z' }) @IsISO8601({ strict: true }, ISO)
  startsAt!: string;

  @ApiPropertyOptional({ minimum: 15, maximum: 480, default: 60 }) @IsOptional() @IsInt() @Min(15) @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Modification d'un rendez-vous à venir : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé, contact `null` = retiré). */
export class UpdateAppointmentDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  contactId?: string | null;

  @ApiPropertyOptional({ minimum: 15, maximum: 480 }) @IsOptional() @IsInt() @Min(15) @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Report, tenue ou annulation : la version lue, et le texte (motif ou compte rendu) obligatoire ; le report porte aussi la nouvelle heure. */
export class TransitionAppointmentDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: '2026-11-12T09:00:00Z' }) @IsOptional() @IsISO8601({ strict: true }, ISO)
  startsAt?: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  text?: string;
}

/** Fenêtre de l'agenda (début inclus, fin exclue, 63 jours au plus), pagination (taille ≤ 200), type, état, entreprise, offre. */
export class ListAppointmentsDto {
  @ApiProperty({ example: '2026-11-09T00:00:00Z' }) @IsISO8601({ strict: true }, ISO)
  from!: string;

  @ApiProperty({ example: '2026-11-16T00:00:00Z' }) @IsISO8601({ strict: true }, ISO)
  to!: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 100, maximum: 200 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize: number = 100;

  @ApiPropertyOptional({ enum: TYPES }) @IsOptional() @IsIn(TYPES)
  type?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  offerId?: string;
}
