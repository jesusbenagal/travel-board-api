import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { ShareLinksService } from './share-links.service';
import { PrismaService } from '../../database/prisma.service';
import { PublicShareCacheService } from './public-share-cache.service';

import { PublicShareThrottleGuard } from './guards/public-share-throttle.guard';

import { createWeakEtag } from '../../common/utils/etag.util';

import type { PublicTripPayload, PublicItem } from './dto/public-trip.response';

@UseGuards(PublicShareThrottleGuard)
@Controller('public/share')
export class PublicShareController {
  constructor(
    private readonly links: ShareLinksService,
    private readonly prisma: PrismaService,
    private readonly cache: PublicShareCacheService,
  ) {}

  @Get(':slug/trip')
  @Throttle({ public: { limit: 30, ttl: seconds(60) } })
  async getTrip(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicTripPayload> {
    // 1) valida slug + contabiliza uso
    const { tripId } = await this.links.resolveSlug(slug);

    // 2) cache por tripId (TTL 30s)
    const payload = await this.cache.getOrSet<PublicTripPayload>(
      `public:trip:${tripId}`,
      30,
      async () => {
        const trip = await this.prisma.trip.findUnique({
          where: { id: tripId },
          select: {
            id: true,
            title: true,
            description: true,
            startDate: true,
            endDate: true,
            timezone: true,
          },
        });
        if (!trip)
          throw new NotFoundException({
            code: 'TRIP_NOT_FOUND',
            message: 'Trip not found',
          });

        const itemsDb = await this.prisma.item.findMany({
          where: { tripId },
          orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            type: true,
            title: true,
            notes: true,
            startAt: true,
            endAt: true,
            timezone: true,
            locationName: true,
            lat: true,
            lng: true,
            url: true,
            order: true,
            _count: { select: { votes: true } },
          },
        });

        const items: PublicItem[] = itemsDb.map((it) => ({
          id: it.id,
          type: it.type,
          title: it.title,
          notes: it.notes,
          startAt: it.startAt,
          endAt: it.endAt,
          timezone: it.timezone,
          locationName: it.locationName,
          lat: it.lat === null ? null : it.lat.toNumber(),
          lng: it.lng === null ? null : it.lng.toNumber(),
          url: it.url,
          order: it.order,
          votesCount: it._count.votes,
        }));

        return { trip, items };
      },
    );

    // 3) ETag + Cache-Control (+ 304 si coincide)
    const etag = createWeakEtag(payload);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=30');

    const ifNoneMatch = req.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) {
      res.status(304);
    }

    return payload;
  }
}
