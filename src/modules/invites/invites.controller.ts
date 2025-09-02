import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { InvitesService } from './invites.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';

import { CreateInviteDto } from './dto/create-invite.dto';

import type { PaginatedResponse } from '../../common/dto/pagination.dto';
import type { InviteView, MyInviteView } from './types';

@ApiTags('Invites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post('trips/:tripId/invites')
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<InviteView> {
    return this.invites.createInvite(tripId, user.userId, dto);
  }

  @Get('me/invites')
  async myInvites(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ): Promise<PaginatedResponse<MyInviteView>> {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
    return this.invites.myInvites(user.email, p, ps);
  }

  @Post('invites/:id/accept')
  @HttpCode(HttpStatus.OK)
  async accept(@CurrentUser() user: AuthUser, @Param('id') inviteId: string) {
    return this.invites.acceptInvite(inviteId, user.userId);
  }

  @Post('invites/:id/decline')
  @HttpCode(HttpStatus.OK)
  async decline(@CurrentUser() user: AuthUser, @Param('id') inviteId: string) {
    return this.invites.declineInvite(inviteId, user.userId);
  }
}
