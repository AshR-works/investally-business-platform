import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class RecordEvaluationDto {
  @ApiProperty({ minimum: 0, maximum: 20, description: 'Note sur 20, deux décimales au plus.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  score!: number;
}

export class UpdateTrainingThresholdsDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ minimum: 0, maximum: 100, description: 'Taux de présence minimal (%) pour un certificat ou une attestation.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  attendanceThresholdPercent!: number;

  @ApiProperty({ minimum: 0, maximum: 20, description: 'Note minimale sur 20 pour un certificat.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  scoreThreshold!: number;
}
