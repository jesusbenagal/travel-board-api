import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { MembersService, type MemberView } from './members.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

import {
  CurrentUser,
  AuthUser,
} from '../../config/decorators/current-user.decorator';

import { UpdateMemberRoleDto } from './dto';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
  ): Promise<{ members: MemberView[] }> {
    const members = await this.members.listMembers(tripId, user.userId);
    return { members };
  }

  @Patch(':userId')
  async updateRole(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberView> {
    return this.members.updateRole(tripId, targetUserId, dto.role, user.userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    return this.members.removeMember(tripId, targetUserId, user.userId);
  }
}
