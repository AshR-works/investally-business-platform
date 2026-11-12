import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/** Paramètres d'un premier envoi (le fichier lui-même est le corps de la requête) : objet propriétaire, titre, catégorie, nom. */
export class UploadDocumentQueryDto {
  @ApiProperty({ example: 'company' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  ownerType!: string;

  @ApiProperty()
  @IsUUID()
  ownerId!: string;

  @ApiProperty({ maxLength: 300 })
  @IsString() @IsNotEmpty() @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  category?: string;

  @ApiProperty({ description: 'Nom d\'origine du fichier (affichage et téléchargement ; jamais utilisé comme chemin).', maxLength: 255 })
  @IsString() @IsNotEmpty() @MaxLength(255)
  fileName!: string;
}

/** Paramètres de l'ajout d'une version : seul le nom du fichier (le document est dans l'adresse). */
export class NewVersionQueryDto {
  @ApiProperty({ maxLength: 255 })
  @IsString() @IsNotEmpty() @MaxLength(255)
  fileName!: string;
}

/** Paramètres de la liste : objet propriétaire, archivés ou non. */
export class ListDocumentsQueryDto {
  @ApiProperty({ example: 'company' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  ownerType!: string;

  @ApiProperty()
  @IsUUID()
  ownerId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  includeArchived?: boolean;
}

/** Paramètres du téléchargement : numéro de version (la courante par défaut). */
export class DownloadQueryDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  version?: number;
}
