import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Corps de la requête d'enregistrement : nom obligatoire, secteur et pays facultatifs, longueurs bornées ; tout autre
 * champ (notamment le propriétaire) est refusé.
 */
export class RegisterCompanyDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}
