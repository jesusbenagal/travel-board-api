import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt() @Min(1) PORT!: number;

  // Auth
  @IsString() JWT_ACCESS_SECRET!: string;
  @IsInt() @Min(60) JWT_ACCESS_TTL!: number;
  @IsString() JWT_REFRESH_SECRET!: string;
  @IsInt() @Min(3600) JWT_REFRESH_TTL!: number;

  // CORS
  @IsString() @IsOptional() CORS_ORIGINS?: string;

  // Meta
  @IsString() APP_VERSION!: string;
  @IsString() COMMIT_SHA!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const transformedEnvs = {
    ...config,
    PORT: Number(config.PORT),
    JWT_ACCESS_TTL: Number(config.JWT_ACCESS_TTL),
    JWT_REFRESH_TTL: Number(config.JWT_REFRESH_TTL),
  };

  const validatedEnvs = plainToInstance(EnvironmentVariables, transformedEnvs, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedEnvs, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Config validation error: ${errors
        .map(
          (e) =>
            `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
        )
        .join(' | ')}`,
    );
  }
  return validatedEnvs;
}
