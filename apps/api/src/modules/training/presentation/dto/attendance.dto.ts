import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const STATUSES = ['PRESENT', 'LATE', 'ABSENT'] as const;

export class RecordAttendanceDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status!: 'PRESENT' | 'LATE' | 'ABSENT';
}
