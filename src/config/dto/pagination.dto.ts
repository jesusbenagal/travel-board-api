import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @IsIn(['createdAt', 'startDate', 'endDate'])
  @IsOptional()
  sortField?: 'createdAt' | 'startDate' | 'endDate' = 'createdAt';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortDir?: 'asc' | 'desc' = 'desc';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
