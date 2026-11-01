import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsUUID, Min } from 'class-validator';

/** Statuts qu'on peut poser à la main (les statuts « Cliente » et « Archivée » ne se posent pas ici). */
export const MANUAL_STATUSES = ['TARGET', 'CONTACTED', 'QUALIFIED'] as const;

export class ChangeStatusDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ enum: MANUAL_STATUSES }) @IsIn(MANUAL_STATUSES)
  status!: (typeof MANUAL_STATUSES)[number];
}

export class ReassignDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1)
  version!: number;

  @ApiProperty({ format: 'uuid' }) @IsUUID()
  ownerUserId!: string;
}
