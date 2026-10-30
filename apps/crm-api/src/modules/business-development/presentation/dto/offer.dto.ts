import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const STATUSES = ['DRAFT', 'SUBMITTED', 'RECEIPT_RECEIVED', 'ACCEPTED', 'REFUSED', 'WITHDRAWN'] as const;
/** Montant en texte décimal (« 4500000 » ou « 4500000,50 ») : jamais de nombre flottant sur le réseau. */
const AMOUNT = /^\s*\d[\d\s]{0,15}([.,]\d{1,2})?\s*$/;

/** Création d'une offre : entreprise, objet et montant obligatoires ; devise XAF par défaut. Tout autre champ est refusé. */
export class RegisterOfferDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  companyId!: string;

  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: '4500000' }) @IsString() @Matches(AMOUNT, { message: 'Le montant doit être un nombre positif (deux décimales au plus)' })
  amount!: string;

  @ApiPropertyOptional({ example: 'XAF' }) @IsOptional() @IsString() @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

/** Modification d'un brouillon : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé). */
export class UpdateOfferDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(AMOUNT, { message: 'Le montant doit être un nombre positif (deux décimales au plus)' })
  amount?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

/** Changement d'état : la version lue ; le motif n'est lu que pour un retrait. */
export class OfferTransitionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Paramètres de la liste : pagination (taille ≤ 100), recherche, entreprise, état. */
export class ListOffersDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: string;
}
