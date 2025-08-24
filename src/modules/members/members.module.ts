import { Module } from '@nestjs/common';

import { MembersController } from './members.controller';
import { MembersService } from './members.service';

import { TripAccessModule } from '../trips/trip-access.module';

@Module({
  imports: [TripAccessModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
