import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ShareLinksService } from './share-links.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

import { CreateShareLinkDto } from './dto/create-share-link.dto';

import type { ShareLinkResponse } from './types';

@ApiTags('Share Links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/share-links')
export class ShareLinksController {
  constructor(private readonly links: ShareLinksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a public read-only share link (OWNER)' })
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Body() dto: CreateShareLinkDto,
  ): Promise<ShareLinkResponse> {
    return this.links.create(tripId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List share links of a trip (OWNER)' })
  async list(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
  ): Promise<ShareLinkResponse[]> {
    return this.links.list(tripId, user.userId);
  }

  @Delete(':linkId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a share link (OWNER)' })
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('linkId') linkId: string,
  ): Promise<void> {
    return this.links.revoke(tripId, user.userId, linkId);
  }
}
