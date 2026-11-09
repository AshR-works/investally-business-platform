import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const ORIGINS = ['CLIENT', 'LEARNER'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Création d'un ambassadeur (décision manuelle) : nom, prénom, origine et date de début ; l'entreprise est obligatoire pour un client. Tout autre champ est refusé. */
export class RegisterAmbassadorDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName!: string;

  @ApiProperty({ enum: ORIGINS }) @IsIn(ORIGINS)
  origin!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiProperty({ example: '2026-11-03' }) @IsString() @Matches(DATE, { message: 'La date de début doit être au format AAAA-MM-JJ' })
  appointedOn!: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Modification : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé, vide = effacé, entreprise `null` = retirée). L'origine ne change pas. */
export class UpdateAmbassadorDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  companyId?: string | null;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DATE, { message: 'La date de début doit être au format AAAA-MM-JJ' })
  appointedOn?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

const STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

/** Archivage (`ARCHIVED`, motif facultatif) ou réactivation (`ACTIVE`) : `version` lue obligatoire. */
export class SetAmbassadorStatusDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES)
  status!: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Paramètres de la liste : pagination (taille ≤ 100), recherche, origine, état, entreprise d'origine. */
export class ListAmbassadorsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ORIGINS }) @IsOptional() @IsIn(ORIGINS)
  origin?: string;

  @ApiPropertyOptional({ enum: STATUSES, description: 'Absent : actifs et archivés.' }) @IsOptional() @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;
}
