import { Module } from '@nestjs/common';

import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

import { TripAccessModule } from '../trips/trip-access.module';

@Module({
  imports: [TripAccessModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
