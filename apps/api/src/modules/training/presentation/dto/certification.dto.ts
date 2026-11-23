import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const KINDS = ['CERTIFICATE', 'ATTESTATION'] as const;

export class IssueCertificationDto {
  @ApiProperty({ enum: KINDS })
  @IsIn(KINDS)
  kind!: 'CERTIFICATE' | 'ATTESTATION';
}

export class RevokeCertificationDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
