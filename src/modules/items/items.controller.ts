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

import { ItemsService } from './items.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../config/decorators/current-user.decorator';

import { CreateItemDto, UpdateItemDto, ListItemsQueryDto } from './dto';

import type { ItemResponse } from './types';

@ApiTags('Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Body() dto: CreateItemDto,
  ): Promise<ItemResponse> {
    return this.items.create(tripId, user.userId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Query() q: ListItemsQueryDto,
  ): Promise<{
    data: ItemResponse[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    return this.items.list(tripId, user.userId, q);
  }

  @Get(':itemId')
  async detail(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('itemId') itemId: string,
  ): Promise<ItemResponse> {
    return this.items.getById(tripId, user.userId, itemId);
  }

  @Patch(':itemId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ): Promise<ItemResponse> {
    return this.items.update(tripId, user.userId, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.items.delete(tripId, user.userId, itemId);
  }
}
