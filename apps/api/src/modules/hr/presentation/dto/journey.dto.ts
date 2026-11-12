import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'La date doit être au format AAAA-MM-JJ';
/** Doivent rester identiques aux listes du domaine (vérifié par `journey.spec.ts`). */
export const JOURNEY_KIND_CODES = ['ONBOARDING', 'OFFBOARDING'];
export const TASK_OWNER_CODES = ['HR', 'MANAGER', 'EMPLOYEE', 'IT'];
const STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export class TemplateTaskDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @MaxLength(150)
  title!: string;

  @ApiProperty({ enum: TASK_OWNER_CODES, description: 'Une étiquette (liste fermée), pas un droit d’accès.' }) @IsIn(TASK_OWNER_CODES)
  owner!: string;

  @ApiProperty({ minimum: -365, maximum: 365, description: 'Jours par rapport à la date de référence (entrée ou départ) ; négatif = avant.' }) @IsInt() @Min(-365) @Max(365)
  dueOffsetDays!: number;
}

export class UpdateTemplateDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ type: [TemplateTaskDto], minItems: 1, maxItems: 30, description: 'La liste complète, dans l’ordre voulu : elle remplace la précédente.' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => TemplateTaskDto)
  tasks!: TemplateTaskDto[];
}

export class LaunchJourneyDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  employeeId!: string;

  @ApiProperty({ enum: JOURNEY_KIND_CODES }) @IsIn(JOURNEY_KIND_CODES)
  kind!: string;

  @ApiPropertyOptional({ example: '2026-12-01', description: 'Absente : la date d’entrée (intégration) ou aujourd’hui (départ).' }) @IsOptional() @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  referenceDate?: string;
}

/** Corps commun : la version lue, pour détecter une modification concurrente. */
export class JourneyVersionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

export class ListJourneysDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: JOURNEY_KIND_CODES }) @IsOptional() @IsIn(JOURNEY_KIND_CODES)
  kind?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES as unknown as string[])
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ default: 1, minimum: 1 }) @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 }) @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 25;
}
