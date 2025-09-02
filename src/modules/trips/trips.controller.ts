import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { TripsService } from './trips.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

import { CreateTripDto, ListTripsQueryDto, UpdateTripDto } from './dto';

import type { TripResponse } from './types';
import type {
  PaginatedResponse,
  PaginationMeta,
} from '../../common/dto/pagination.dto';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTripDto,
  ): Promise<TripResponse> {
    return this.trips.create(user.userId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() q: ListTripsQueryDto,
  ): Promise<PaginatedResponse<TripResponse>> {
    const { data, total } = await this.trips.list({
      ownerId: user.userId,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      sortField: q.sortField ?? 'createdAt',
      sortDir: q.sortDir ?? 'desc',
    });
    const pagination: PaginationMeta = {
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      total,
    };
    return { data, pagination };
  }

  @Get(':tripId')
  async detail(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
  ): Promise<TripResponse> {
    return this.trips.getById(tripId, user.userId);
  }

  @Patch(':tripId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Body() dto: UpdateTripDto,
  ): Promise<TripResponse> {
    return this.trips.update(tripId, user.userId, dto);
  }

  @Delete(':tripId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
  ): Promise<void> {
    await this.trips.delete(tripId, user.userId);
  }
}
