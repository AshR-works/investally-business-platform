import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

/** Enregistrement d'une décharge : l'offre, la date de réception (AAAA-MM-JJ) et la personne qui l'a remise. Tout autre champ est refusé. */
export class RegisterReceiptDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  offerId!: string;

  @ApiProperty({ example: '2026-11-03' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de réception doit être au format AAAA-MM-JJ' })
  receivedOn!: string;

  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150)
  receivedBy!: string;
}

/** Annulation d'une décharge : la version lue et le motif (obligatoire). */
export class CancelReceiptDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

/** Liste des décharges d'une offre. */
export class ListReceiptsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  offerId!: string;
}
