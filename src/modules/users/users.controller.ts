import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type PublicUser, UsersService } from './users.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

import {
  type AuthUser,
  CurrentUser,
} from '../../config/decorators/current-user.decorator';

import { UpdateMeDto } from './dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.usersService.getMe(user.userId);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() data: UpdateMeDto,
  ): Promise<PublicUser> {
    return this.usersService.updateMe(user.userId, data);
  }
}
