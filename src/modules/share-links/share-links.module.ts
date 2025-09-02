import { Module } from '@nestjs/common';

import { TripAccessModule } from '../trips/trip-access.module';

import { ShareLinksService } from './share-links.service';
import { ShareLinksController } from './share-links.controller';
import { PublicShareController } from './public-share.controller';

@Module({
  imports: [TripAccessModule],
  controllers: [ShareLinksController, PublicShareController],
  providers: [ShareLinksService],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
