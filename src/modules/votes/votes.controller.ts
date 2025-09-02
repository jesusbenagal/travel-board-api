import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { VotesService } from './votes.service';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Votes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips/:tripId/items/:itemId/votes')
export class VotesController {
  constructor(private readonly votes: VotesService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('itemId') itemId: string,
  ): Promise<{ itemId: string; votesCount: number }> {
    return this.votes.addVote(tripId, itemId, user.userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tripId') tripId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.votes.removeVote(tripId, itemId, user.userId);
  }
}
