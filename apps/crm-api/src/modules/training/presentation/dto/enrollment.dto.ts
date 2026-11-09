import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'TO_REPLACE'] as const;

export class ListLearnersDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;
}

export class CreateLearnerDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  companyId!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  lastName!: string;

  @ApiProperty({ maxLength: 100 }) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(60)
  phone?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Contact de la même entreprise (facultatif)' }) @IsOptional() @ValidateIf((o: CreateLearnerDto) => o.contactId !== null) @IsUUID()
  contactId?: string | null;

  @ApiPropertyOptional({ description: 'Créer malgré un doublon probable (même entreprise, même nom ou même e-mail)' }) @IsOptional() @IsBoolean()
  allowDuplicate?: boolean;
}

export class UpdateLearnerDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(60)
  phone?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @ValidateIf((o: UpdateLearnerDto) => o.contactId !== null) @IsUUID()
  contactId?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  allowDuplicate?: boolean;
}

/** Suppression logique, gardée par la version lue. */
export class DeleteLearnerDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

export class ListEnrollmentsDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  learnerId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES)
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'TO_REPLACE';
}

export class ApprovalOptionsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  learnerId!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  sessionId!: string;
}

export class EnrollDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  sessionId!: string;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  learnerId!: string;

  @ApiProperty({ format: 'uuid', description: "Agrément de l'entreprise de l'apprenant qui couvre l'inscription" }) @IsUUID()
  approvalId!: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  comment?: string;
}

export class ConfirmEnrollmentDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;
}

export class CancelEnrollmentDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ maxLength: 500 }) @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export class ReplaceEnrollmentDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ format: 'uuid', description: 'Autre session ouverte' }) @IsUUID()
  sessionId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Autre agrément ; par défaut celui de l'inscription actuelle" }) @IsOptional() @IsUUID()
  approvalId?: string;

  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  comment?: string;
}
