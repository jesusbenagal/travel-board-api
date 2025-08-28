import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { TripAccessService } from '../trips/trip-access.service';

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}

  private async requireItemInTrip(tripId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: {
        tripId,
        id: itemId,
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found',
      });
    }

    return item;
  }

  async addVote(
    tripId: string,
    itemId: string,
    userId: string,
  ): Promise<{ itemId: string; votesCount: number }> {
    await this.access.requireMember(tripId, userId);
    await this.requireItemInTrip(tripId, itemId);

    // Pre-check para responder 409 controlado (y fallback a P2002 por carrera)
    const existing = await this.prisma.itemVote.findUnique({
      where: { itemId_userId: { itemId, userId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'VOTE_CONFLICT',
        message: 'Already voted',
      });
    }

    try {
      await this.prisma.itemVote.create({ data: { itemId, userId } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'VOTE_CONFLICT',
          message: 'Already voted',
        });
      }
      throw e;
    }

    const votesCount = await this.prisma.itemVote.count({ where: { itemId } });
    return { itemId, votesCount };
  }

  async removeVote(
    tripId: string,
    itemId: string,
    userId: string,
  ): Promise<void> {
    await this.access.requireMember(tripId, userId);
    await this.requireItemInTrip(tripId, itemId);

    try {
      await this.prisma.itemVote.delete({
        where: { itemId_userId: { itemId, userId } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        // No existía el voto
        throw new NotFoundException({
          code: 'VOTE_NOT_FOUND',
          message: 'Vote not found',
        });
      }
      throw e;
    }
  }
}
