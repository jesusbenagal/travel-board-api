import { Module } from '@nestjs/common';

import { TripAccessService } from './trip-access.service';

@Module({
  providers: [TripAccessService],
  exports: [TripAccessService],
})
export class TripAccessModule {}
