import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { UpdateFacilitationDto } from './register-company.dto';

/**
 * Corps de la modification d'une entreprise : `version` (celle que l'appelant a lue) est obligatoire, tout le reste est
 * facultatif (absent = inchangé, chaîne vide = champ effacé) ; `facilitation: null` retire le facilitateur. Tout autre
 * champ (notamment le propriétaire et le statut) est refusé.
 */
export class UpdateCompanyDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100)
  sector?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ type: UpdateFacilitationDto, nullable: true }) @IsOptional() @ValidateNested() @Type(() => UpdateFacilitationDto)
  facilitation?: UpdateFacilitationDto | null;
}
