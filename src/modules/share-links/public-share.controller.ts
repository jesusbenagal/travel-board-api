import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ShareLinksService } from './share-links.service';
import { PrismaService } from '../../database/prisma.service';

import type { PublicTripPayload } from './dto/public-trip.response';

@ApiTags('Public Share')
@Controller('public/share')
export class PublicShareController {
  constructor(
    private readonly links: ShareLinksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':slug/trip')
  @ApiOperation({
    summary: 'Get public read-only trip (items included) by share slug',
  })
  async getTrip(@Param('slug') slug: string): Promise<PublicTripPayload> {
    const { tripId } = await this.links.resolveSlug(slug);

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
    if (!trip) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
      });
    }

    const items = await this.prisma.item.findMany({
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

    return {
      trip,
      items: items.map((it) => ({
        id: it.id,
        type: it.type,
        title: it.title,
        notes: it.notes,
        startAt: it.startAt,
        endAt: it.endAt,
        timezone: it.timezone,
        locationName: it.locationName,
        lat: it.lat,
        lng: it.lng,
        url: it.url,
        order: it.order,
        votesCount: it._count.votes,
      })),
    };
  }
}
