import { Module } from '@nestjs/common';
import { TripAccessModule } from '../trips/trip-access.module';
import { ShareLinksService } from './share-links.service';
import { PublicShareCacheService } from './public-share-cache.service';

import { ShareLinksController } from './share-links.controller';
import { PublicShareController } from './public-share.controller';

import { PublicShareThrottleGuard } from './guards/public-share-throttle.guard';

@Module({
  imports: [TripAccessModule],
  controllers: [ShareLinksController, PublicShareController],
  providers: [
    ShareLinksService,
    PublicShareThrottleGuard,
    PublicShareCacheService,
  ],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
