import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'La date doit être au format AAAA-MM-JJ';
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
const VIEWS = ['mine', 'team', 'all'] as const;

/** Demande d'absence. Aucune donnée de santé : le motif est libre et facultatif, jamais un diagnostic. */
export class RequestLeaveDto {
  @ApiPropertyOptional({ format: 'uuid', description: "Absent : l'employé de votre compte. La RH peut désigner un autre employé (demande validée d'emblée)." }) @IsOptional() @IsUUID()
  employeeId?: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-12-21' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  start!: string;

  @ApiProperty({ example: '2026-12-24' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  end!: string;

  @ApiPropertyOptional({ description: "La première journée commence l'après-midi." }) @IsOptional() @IsBoolean()
  startHalf?: boolean;

  @ApiPropertyOptional({ description: "La dernière journée s'arrête à midi." }) @IsOptional() @IsBoolean()
  endHalf?: boolean;

  @ApiPropertyOptional({ maxLength: 500, description: 'Motif libre facultatif. Jamais de diagnostic.' }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class DecideLeaveDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] }) @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ maxLength: 500, description: 'Obligatoire pour un refus.' }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

export class CancelLeaveDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Obligatoire pour une demande déjà validée.' }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

export class ListLeaveRequestsDto {
  @ApiPropertyOptional({ enum: VIEWS, default: 'mine' }) @IsOptional() @IsIn(VIEWS)
  view?: (typeof VIEWS)[number];

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ minimum: 2000, maximum: 2100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  year?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 }) @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 }) @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 25;
}

export class LeaveBalanceDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ minimum: 2000, maximum: 2100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  year?: number;
}

export class TeamCalendarDto {
  @ApiProperty({ example: '2026-12-01' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  from!: string;

  @ApiProperty({ example: '2026-12-31' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  to!: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'Service (RH et Direction) ; les autres voient le service de leur fiche.' }) @IsOptional() @IsString() @MaxLength(100)
  department?: string;
}

export class ListLeaveTypesDto {
  @ApiPropertyOptional({ description: 'Inclure les types désactivés (RH).' }) @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  includeInactive?: boolean;
}

export class CreateLeaveTypeDto {
  @ApiProperty({ maxLength: 30, example: 'STUDY' }) @IsString() @IsNotEmpty() @MaxLength(30)
  code!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ description: 'Décompte le solde de congé annuel.' }) @IsOptional() @IsBoolean()
  deductsBalance?: boolean;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ nullable: true, description: "Plafond de jours par demande ; absent = aucun." }) @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0.5) @Max(365)
  maxDaysPerRequest?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10000)
  sortOrder?: number;
}

export class UpdateLeaveTypeDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  label?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  deductsBalance?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0.5) @Max(365)
  maxDaysPerRequest?: number | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10000)
  sortOrder?: number;
}

export class UpdateLeaveSettingsDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ minimum: 0, maximum: 5, description: 'Jours acquis par mois de service.' }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(5)
  accrualDaysPerMonth!: number;

  @ApiProperty({ description: 'Vrai : le samedi compte aussi.' }) @IsBoolean()
  countsSaturday!: boolean;

  @ApiProperty() @IsBoolean()
  allowHalfDays!: boolean;

  @ApiProperty() @IsBoolean()
  allowNegativeBalance!: boolean;
}

export class HolidaysQueryDto {
  @ApiProperty({ minimum: 2000, maximum: 2100 }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  year!: number;
}

export class AddHolidayDto {
  @ApiProperty({ example: '2026-12-25' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  day!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  label!: string;
}

export class AdjustBalanceDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  employeeId!: string;

  @ApiProperty({ minimum: 2000, maximum: 2100 }) @IsInt() @Min(2000) @Max(2100)
  year!: number;

  @ApiProperty({ description: 'Jours ajoutés (positif) ou retirés (négatif), par demi-journée, de 60 au plus en valeur absolue.' }) @IsNumber({ maxDecimalPlaces: 1 }) @Min(-60) @Max(60)
  days!: number;

  @ApiProperty({ maxLength: 500 }) @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export class ListAdjustmentsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  employeeId!: string;

  @ApiProperty({ minimum: 2000, maximum: 2100 }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  year!: number;
}
