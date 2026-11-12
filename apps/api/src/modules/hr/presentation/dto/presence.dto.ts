import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'La date doit être au format AAAA-MM-JJ';
/** Doit rester identique à la liste du domaine (vérifié par `presence.spec.ts`). */
export const PRESENCE_MODE_CODES = ['ON_SITE', 'REMOTE', 'TRAVEL'];

export class DeclarePresenceDto {
  @ApiProperty({ enum: PRESENCE_MODE_CODES, description: 'Sur site, télétravail ou déplacement. Aucune heure, aucun lieu.' }) @IsIn(PRESENCE_MODE_CODES)
  mode!: string;
}

export class PresenceTargetDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Absent : l’employé du compte connecté. Seule la RH peut désigner un autre employé.' }) @IsOptional() @IsUUID()
  employeeId?: string;
}

export class PresenceBoardDto {
  @ApiProperty({ example: '2026-11-09' }) @Matches(DATE, { message: DATE_MESSAGE })
  from!: string;

  @ApiProperty({ example: '2026-11-15' }) @Matches(DATE, { message: DATE_MESSAGE })
  to!: string;

  @ApiPropertyOptional({ maxLength: 100 }) @IsOptional() @IsString() @MaxLength(100)
  department?: string;
}
