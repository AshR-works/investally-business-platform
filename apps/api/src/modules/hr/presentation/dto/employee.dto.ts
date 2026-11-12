import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
const DATE_MESSAGE = 'La date doit être au format AAAA-MM-JJ';

/** Création d'un employé : identité PROFESSIONNELLE seulement (D57). Tout autre champ est refusé (salaire, adresse personnelle, date de naissance… n'existent pas). */
export class RegisterEmployeeDto {
  @ApiPropertyOptional({ maxLength: 30 }) @IsOptional() @IsString() @MaxLength(30)
  matricule?: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName!: string;

  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150)
  jobTitle!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  department!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID()
  managerEmployeeId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Compte lié (0 ou 1).' }) @IsOptional() @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  workEmail?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  workPhone?: string;

  @ApiProperty({ example: '2026-11-03' }) @IsString() @Matches(DATE, { message: "La date d'entrée doit être au format AAAA-MM-JJ" })
  hiredOn!: string;
}

/** Modification : `version` lue obligatoire ; le reste est facultatif (absent = inchangé, vide = effacé, responsable ou compte `null` = retiré). */
export class UpdateEmployeeDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 30 }) @IsOptional() @IsString() @MaxLength(30)
  matricule?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 150 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  managerEmployeeId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  workEmail?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  workPhone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DATE, { message: "La date d'entrée doit être au format AAAA-MM-JJ" })
  hiredOn?: string;
}

/** Archivage (`ARCHIVED` : sortie du personnel, date et motif facultatifs) ou réactivation (`ACTIVE`) : `version` lue obligatoire. */
export class SetEmployeeStatusDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES)
  status!: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: "Date de sortie ; aujourd'hui par défaut." }) @IsOptional() @IsString() @Matches(DATE, { message: DATE_MESSAGE })
  leftOn?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Liste détaillée : pagination (taille ≤ 100), recherche, état, service. */
export class ListEmployeesDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: STATUSES, description: 'Absent : actifs et archivés.' }) @IsOptional() @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  department?: string;
}

/** Annuaire restreint : pagination (taille ≤ 100), recherche, service. */
export class ListDirectoryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 50;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  department?: string;
}
