import { Module } from '@nestjs/common';

import { TripAccessModule } from '../trips/trip-access.module';

import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [TripAccessModule],
  controllers: [VotesController],
  providers: [VotesService],
  exports: [VotesService],
})
export class VotesModule {}
