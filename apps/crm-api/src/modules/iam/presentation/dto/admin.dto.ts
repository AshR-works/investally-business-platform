import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export enum UserStatusFilter {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Locked = 'LOCKED',
  Disabled = 'DISABLED',
}

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

export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  displayName?: string;

  /** `null` retire le responsable ; absent = inchangé. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsUUID()
  managerId?: string | null;
}

export class AssignRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(50, { each: true })
  roles!: string[];
}

export class AcceptInvitationDto {
  /** Jeton reçu dans le fragment du lien d'invitation. Plafonné : jamais de chaîne démesurée. */
  @ApiProperty({ maxLength: 200 })
  @IsString() @IsNotEmpty() @MaxLength(200)
  token!: string;

  @ApiProperty({ maxLength: 256 })
  @IsString() @IsNotEmpty() @MaxLength(256)
  password!: string;
}
