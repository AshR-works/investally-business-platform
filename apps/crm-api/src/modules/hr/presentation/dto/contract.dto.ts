import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'La date doit être au format AAAA-MM-JJ';
/** Motifs de fin : doit rester identique à `END_REASONS` du domaine (vérifié par `contract.spec.ts`). */
export const END_REASON_CODES = ['FIXED_TERM_END', 'PROBATION_END', 'RESIGNATION', 'MISSION_END', 'OTHER'];

export class ListContractTypesDto {
  @ApiPropertyOptional({ description: 'Inclure les types désactivés (RH seulement).' }) @IsOptional() @Type(() => Boolean) @IsBoolean()
  includeInactive?: boolean;
}

export class CreateContractTypeDto {
  @ApiProperty({ example: 'APPRENTI', description: 'Majuscules, chiffres et _ (2 à 30 caractères).' }) @IsString() @MaxLength(30)
  code!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @MaxLength(100)
  label!: string;

  @ApiProperty({ description: 'Vrai : la date de fin est obligatoire ; faux : le contrat n’en a jamais.' }) @IsBoolean()
  fixedTerm!: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000 }) @IsOptional() @IsInt() @Min(0) @Max(10000)
  sortOrder?: number;
}

export class UpdateContractTypeDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100)
  label?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000 }) @IsOptional() @IsInt() @Min(0) @Max(10000)
  sortOrder?: number;
}

/** Création d'un contrat. Aucun salaire, aucun document : seulement un type et des dates. */
export class CreateContractDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  employeeId!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  contractTypeId!: string;

  @ApiProperty({ example: '2026-12-01' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  start!: string;

  @ApiPropertyOptional({ example: '2027-05-31', nullable: true, description: 'Obligatoire pour un type à durée déterminée, interdite sinon.' }) @IsOptional() @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  end?: string | null;

  @ApiPropertyOptional({ example: '2027-02-28', nullable: true }) @IsOptional() @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  probationEnd?: string | null;
}

export class AdjustContractDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Nouvelle fin (contrat à durée déterminée en cours).' }) @IsOptional() @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  end?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  probationEnd?: string | null;
}

export class EndContractDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ example: '2027-05-31' }) @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  endedOn!: string;

  @ApiProperty({ enum: END_REASON_CODES, description: 'Motif choisi dans une liste fermée ; jamais un texte libre.' }) @IsIn(END_REASON_CODES)
  reason!: string;
}

export class ListContractsDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ENDED'] }) @IsOptional() @IsIn(['ACTIVE', 'ENDED'])
  status?: 'ACTIVE' | 'ENDED';

  @ApiPropertyOptional({ default: 1, minimum: 1 }) @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 }) @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 25;
}

export class DeadlinesQueryDto {
  @ApiPropertyOptional({ default: 60, minimum: 1, maximum: 365, description: 'Fenêtre en jours à partir d’aujourd’hui.' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365)
  days?: number;
}
