import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export enum UserStatusFilter {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Locked = 'LOCKED',
  Disabled = 'DISABLED',
}

/** Paramètres de la liste des utilisateurs : page, taille ≤ 100, recherche ≤ 100 caractères, statut connu. */
export class ListUsersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: UserStatusFilter })
  @IsOptional() @IsEnum(UserStatusFilter)
  status?: UserStatusFilter;
}

/** Corps d'une invitation : adresse, nom, 1 à 10 rôles, responsable facultatif ; tout autre champ est refusé. */
export class InviteUserDto {
  @ApiProperty({ maxLength: 254 })
  @IsString() @IsNotEmpty() @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString() @IsNotEmpty() @MaxLength(200)
  displayName!: string;

  @ApiProperty({ type: [String], description: 'Codes de rôle (voir GET /admin/roles)' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(50, { each: true })
  roles!: string[];

  @ApiPropertyOptional({ description: 'Responsable direct (portée Équipe)' })
  @IsOptional() @IsUUID()
  managerId?: string;
}

/** Corps d'une modification : nom et/ou responsable. */
export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  displayName?: string;

  /** `null` retire le responsable ; absent = inchangé. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsUUID()
  managerId?: string | null;
}

/** Corps d'une attribution de rôles : 1 à 10 codes de rôle. */
export class AssignRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(50, { each: true })
  roles!: string[];
}

/** Corps d'activation d'un compte invité : jeton du lien et mot de passe choisi (tailles bornées). */
export class AcceptInvitationDto {
  /** Jeton reçu dans le fragment du lien d'invitation. Plafonné : jamais de chaîne démesurée. */
  @ApiProperty({ maxLength: 200 })
  @IsString() @IsNotEmpty() @MaxLength(200)
  token!: string;

  @ApiProperty({ maxLength: 256 })
  @IsString() @IsNotEmpty() @MaxLength(256)
  password!: string;
}

/**
 * Corps de « mot de passe oublié » : l'adresse saisie, sans validation de forme (la réponse est identique pour toute
 * saisie).
 */
export class RequestPasswordResetDto {
  /** Volontairement non validé comme e-mail : la réponse est identique pour toute saisie (aucune énumération de comptes). */
  @ApiProperty({ maxLength: 254 })
  @IsString() @MaxLength(254)
  email!: string;
}

/** Corps du choix d'un nouveau mot de passe : jeton du lien (fragment d'URL) et mot de passe, tailles bornées. */
export class ResetPasswordDto {
  /** Jeton reçu dans le fragment du lien. Plafonné : jamais de chaîne démesurée. */
  @ApiProperty({ maxLength: 200 })
  @IsString() @IsNotEmpty() @MaxLength(200)
  token!: string;

  @ApiProperty({ maxLength: 256 })
  @IsString() @IsNotEmpty() @MaxLength(256)
  password!: string;
}

/**
 * Paramètres de l'historique des connexions : taille (1 à 100) et curseur `before` (date ISO 8601 de la page
 * précédente). Aucun identifiant d'utilisateur n'est accepté : l'historique est toujours celui de l'appelant.
 */
export class LoginHistoryQueryDto {
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Curseur : date ISO 8601 renvoyée par la page précédente (nextBefore).' })
  @IsOptional() @IsISO8601({ strict: true })
  before?: string;
}
