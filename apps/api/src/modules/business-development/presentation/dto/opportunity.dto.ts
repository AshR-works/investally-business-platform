import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const SOURCES = ['PROSPECTING', 'REFERRAL', 'EVENT', 'INBOUND', 'OTHER'] as const;
const STATUSES = ['OPEN', 'WON', 'LOST'] as const;
const STAGES = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'AGREEMENT_IN_PRINCIPLE', 'ACCREDITATION'] as const;
const LOSS_REASONS = ['PRICE', 'COMPETITOR', 'NO_BUDGET', 'NO_RESPONSE', 'NOT_INTERESTED', 'OTHER'] as const;
const AMOUNT = /^\s*\d[\d\s]*([.,]\d{1,2})?\s*$/;

/** Création : l'entreprise, l'intitulé, le montant estimé et la source ; la devise est facultative (XAF par défaut). Tout autre champ est refusé. */
export class CreateOpportunityDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  companyId!: string;

  @ApiProperty({ maxLength: 200 }) @IsString() @MaxLength(200)
  title!: string;

  @ApiProperty({ example: '12500000' }) @Matches(AMOUNT, { message: 'Le montant estimé doit être un nombre positif' })
  amount!: string;

  @ApiPropertyOptional({ example: 'XAF' }) @IsOptional() @IsString() @MaxLength(4)
  currency?: string;

  @ApiProperty({ enum: SOURCES }) @IsIn(SOURCES)
  source!: string;
}

/** Modification d'une opportunité ouverte : `version` (celle qui a été lue) obligatoire ; le reste est facultatif (absent = inchangé). */
export class UpdateOpportunityDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @Matches(AMOUNT, { message: 'Le montant estimé doit être un nombre positif' })
  amount?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4)
  currency?: string;

  @ApiPropertyOptional({ enum: SOURCES }) @IsOptional() @IsIn(SOURCES)
  source?: string;
}

/** Avancer : seulement la version lue. */
export class AdvanceOpportunityDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

/** Dérogation : la version lue et la justification (obligatoire). */
export class WaiverDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Clôture « perdue » : la version lue, le motif de la liste fermée et une précision (obligatoire pour « autre »). */
export class CloseLostDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ enum: LOSS_REASONS }) @IsIn(LOSS_REASONS)
  reason!: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Clôture « gagnée » : seulement la version lue. */
export class CloseWonDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

/** Paramètres de la liste : pagination (taille ≤ 200), recherche, entreprise, état, étape. */
export class ListOpportunitiesDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize: number = 50;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: STAGES }) @IsOptional() @IsIn(STAGES)
  stage?: string;
}
