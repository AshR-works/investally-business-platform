import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { COMPANY_SORT_FIELDS, CompanyStatus, type CompanySortField } from '../../application/list-companies.query';

/** Paramètres de requête de la liste (page, taille ≤ 100, recherche, filtres, tri) validés avant d'atteindre le cas d'usage. */
export class ListCompaniesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional() @IsIn(Object.values(CompanyStatus))
  status?: CompanyStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  sector?: string;

  @ApiPropertyOptional({ enum: COMPANY_SORT_FIELDS, default: 'createdAt' })
  @IsOptional() @IsIn(COMPANY_SORT_FIELDS)
  sort?: CompanySortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';
}

/** Paramètres de la synthèse (compteurs par statut) : mêmes filtres que la liste, hors statut. */
export class CompanyOverviewDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  sector?: string;
}
