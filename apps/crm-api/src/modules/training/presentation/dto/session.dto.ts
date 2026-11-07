import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const STATUSES = ['PLANNED', 'OPEN', 'CLOSED', 'CANCELLED'] as const;
const RHYTHMS = ['DAY', 'EVENING'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ListSessionsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: 'PLANNED' | 'OPEN' | 'CLOSED' | 'CANCELLED';

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  trainerId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  trainingId?: string;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Sessions qui recouvrent la période : début (AAAA-MM-JJ)' }) @IsOptional() @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Sessions qui recouvrent la période : fin (AAAA-MM-JJ)' }) @IsOptional() @Matches(DATE)
  to?: string;
}

export class PlanSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  trainingId!: string;

  @ApiProperty({ enum: RHYTHMS }) @IsIn(RHYTHMS)
  rhythm!: 'DAY' | 'EVENING';

  @ApiProperty({ example: '2026-11-16', description: 'Date de début (un jour de cours) ; la date de fin se déduit du rythme' }) @IsString() @Matches(DATE)
  startDate!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  roomId!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  trainerId!: string;

  @ApiProperty({ minimum: 1, maximum: 1000 }) @IsInt() @Min(1) @Max(1000)
  capacity!: number;
}

export class UpdateSessionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  trainerId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 }) @IsOptional() @IsInt() @Min(1) @Max(1000)
  capacity?: number;
}

/** Ouverture aux inscriptions : gardée par la version lue. */
export class OpenSessionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

export class PostponeSessionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ example: '2026-11-23', description: 'Nouvelle date de début (un jour de cours, pas dans le passé)' }) @IsString() @Matches(DATE)
  startDate!: string;

  @ApiProperty({ maxLength: 500 }) @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export class CancelSessionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ maxLength: 500 }) @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}
