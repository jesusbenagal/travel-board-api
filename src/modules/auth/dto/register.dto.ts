import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain upper, lower and digit',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
