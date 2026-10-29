import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

const CONTACT_METHODS = ['WHATSAPP_MESSAGE', 'PHONE_CALL', 'EMAIL', 'MEETING', 'OTHER'] as const;

/** Nouveau facilitateur saisi à la création de l'entreprise. */
export class NewFacilitatorDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName!: string;

  @ApiProperty({ maxLength: 40 }) @IsString() @IsNotEmpty() @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}

/** Commission : montant fixe (avec devise) ou pourcentage. Le montant voyage en texte pour éviter les flottants. */
export class CommissionDto {
  @ApiProperty({ enum: ['FIXED', 'PERCENT'] }) @IsIn(['FIXED', 'PERCENT'])
  type!: string;

  @ApiProperty({ example: '1500.00' }) @IsString() @IsNotEmpty() @MaxLength(16)
  value!: string;

  @ApiPropertyOptional({ example: 'XAF', description: 'Trois lettres (ISO 4217) ; absente ou « FCFA » = XAF' }) @IsOptional() @IsString() @MaxLength(4)
  currency?: string;
}

/** Facilitateur par qui l'entreprise a été approchée : existant (identifiant) OU nouveau, plus la méthode de contact. */
export class FacilitationDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  facilitatorId?: string;

  @ApiPropertyOptional({ type: NewFacilitatorDto }) @IsOptional() @ValidateNested() @Type(() => NewFacilitatorDto)
  newFacilitator?: NewFacilitatorDto;

  @ApiProperty({ enum: CONTACT_METHODS }) @IsIn(CONTACT_METHODS)
  contactMethod!: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isCompanyEmployee?: boolean;

  @ApiPropertyOptional({ type: CommissionDto }) @IsOptional() @ValidateNested() @Type(() => CommissionDto)
  commission?: CommissionDto;
}

/**
 * Corps de la requête d'enregistrement : nom obligatoire, le reste facultatif, longueurs bornées ; tout autre champ
 * (notamment le propriétaire) est refusé.
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

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ type: FacilitationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilitationDto)
  facilitation?: FacilitationDto;
}
