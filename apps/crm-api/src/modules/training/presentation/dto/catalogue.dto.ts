import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
const ACTIONS = ['archive', 'reactivate'] as const;
const ROOM_KINDS = ['WORKSTATIONS', 'CLASSROOM'] as const;

/** Paramètres communs des listes : pagination (taille ≤ 100), recherche, état. */
export class ListCatalogueDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: 'ACTIVE' | 'ARCHIVED';
}

export class ListTrainingsDto extends ListCatalogueDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  programId?: string;
}

/** Archivage ou réactivation, gardés par la version lue. */
export class ChangeCatalogueStatusDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ enum: ACTIONS }) @IsIn(ACTIONS)
  action!: 'archive' | 'reactivate';
}

export class CreateProgramDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  audience?: string;
}

/** Modification : `version` obligatoire ; champ absent = inchangé, texte vide = effacé. */
export class UpdateProgramDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 150 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  audience?: string;
}

export class CreateTrainingDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  programId!: string;

  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  objectives?: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  prerequisites?: string;

  @ApiPropertyOptional({ example: '750000.00', description: 'Prix du certificat complet.' }) @IsOptional() @IsNumberString({ no_symbols: false }) @MaxLength(15)
  priceAmount?: string;

  @ApiPropertyOptional({ example: '125000.00', description: 'Prix de chaque module (le prix complet diffère de leur somme).' }) @IsOptional() @IsNumberString({ no_symbols: false }) @MaxLength(15)
  modulePriceAmount?: string;

  @ApiPropertyOptional({ example: 'XAF', description: 'Devise ISO des deux prix (XAF par défaut).' }) @IsOptional() @Matches(/^[A-Za-z]{3}$/, { message: 'La devise doit comporter trois lettres' })
  priceCurrency?: string;

  @ApiPropertyOptional({ type: [String], description: 'Modules du certificat, dans leur ordre.' }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true })
  moduleIds?: string[];
}

/** Modification d'un certificat : le programme ne change pas ; un prix `null` est retiré ; `moduleIds` remplace la liste ordonnée entière. */
export class UpdateTrainingDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 150 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000)
  objectives?: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  prerequisites?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumberString({ no_symbols: false }) @MaxLength(15)
  priceAmount?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumberString({ no_symbols: false }) @MaxLength(15)
  modulePriceAmount?: string | null;

  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Za-z]{3}$/, { message: 'La devise doit comporter trois lettres' })
  priceCurrency?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true })
  moduleIds?: string[];
}

export class CreateModuleDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @IsNotEmpty() @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Pratique sur poste de travail (faux par défaut).' }) @IsOptional() @IsBoolean()
  requiresWorkstations?: boolean;
}

export class UpdateModuleDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 150 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  requiresWorkstations?: boolean;
}

export class CreateRoomDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: ROOM_KINDS, description: 'Avec postes de travail (par défaut) ou salle de cours.' }) @IsOptional() @IsIn(ROOM_KINDS)
  kind?: 'WORKSTATIONS' | 'CLASSROOM';

  @ApiProperty({ minimum: 1, maximum: 1000, description: 'Postes apprenants installés.' }) @IsInt() @Min(1) @Max(1000)
  learnerSeats!: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Postes apprenants hors service (0 par défaut).' }) @IsOptional() @IsInt() @Min(0) @Max(1000)
  unavailableSeats?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10, description: 'Postes formateur (1 par défaut).' }) @IsOptional() @IsInt() @Min(0) @Max(10)
  trainerSeats?: number;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  equipment?: string;
}

export class UpdateRoomDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ROOM_KINDS }) @IsOptional() @IsIn(ROOM_KINDS)
  kind?: 'WORKSTATIONS' | 'CLASSROOM';

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 }) @IsOptional() @IsInt() @Min(1) @Max(1000)
  learnerSeats?: number;

  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsInt() @Min(0) @Max(1000)
  unavailableSeats?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 }) @IsOptional() @IsInt() @Min(0) @Max(10)
  trainerSeats?: number;

  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000)
  equipment?: string;
}

export class CreateTrainerDto {
  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  specialties?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Compte utilisateur du formateur interne ; absent = formateur externe.' }) @IsOptional() @IsUUID()
  userId?: string;
}

export class UpdateTrainerDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  specialties?: string;

  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 40 }) @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  userId?: string | null;
}
