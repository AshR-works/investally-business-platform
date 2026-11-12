import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const ROLES = ['FINANCE_DIRECTOR', 'DECISION_MAKER', 'OTHER'] as const;

/** Création d'un contact : l'entreprise (identifiant), le nom et le prénom sont obligatoires. Tout autre champ est refusé. */
export class RegisterContactDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  companyId!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES)
  role?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ description: 'Créer malgré un doublon probable (l’utilisateur a vu l’avertissement)' }) @IsOptional() @IsBoolean()
  allowDuplicate?: boolean;
}

/** Modification : `version` (celle qui a été lue) est obligatoire ; le reste est facultatif (absent = inchangé, vide = effacé). */
export class UpdateContactDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES)
  role?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  allowDuplicate?: boolean;
}

/** Paramètres de la liste : pagination (taille ≤ 100), recherche, entreprise, fonction. */
export class ListContactsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ROLES }) @IsOptional() @IsIn(ROLES)
  role?: string;
}
