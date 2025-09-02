import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateShareLinkDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, maxDecimalPlaces: 0 })
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}
