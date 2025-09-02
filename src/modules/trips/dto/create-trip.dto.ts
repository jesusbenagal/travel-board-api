import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Visibility } from '@prisma/client';

import { IsIanaTimeZone } from '../../../common/validators/iana-timezone.validator';

export class CreateTripDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIanaTimeZone()
  timezone!: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility = Visibility.PRIVATE;
}
