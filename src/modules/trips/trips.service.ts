import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { CreateTripDto, UpdateTripDto } from './dto';

import type { TripResponse } from './types';

interface ListParams {
  ownerId: string;
  page: number;
  pageSize: number;
  sortField: 'createdAt' | 'startDate' | 'endDate';
  sortDir: 'asc' | 'desc';
}

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureDates(
    startISO: string,
    endISO: string,
  ): { start: Date; end: Date } {
    const start = new Date(startISO);
    const end = new Date(endISO);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid date format',
      });
    }
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'startDate must be before or equal to endDate',
        details: { startDate: startISO, endDate: endISO },
      });
    }

    return { start, end };
  }

  async create(ownerId: string, dto: CreateTripDto): Promise<TripResponse> {
    const { start, end } = this.ensureDates(dto.startDate, dto.endDate);

    const trip = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          ownerId,
          title: dto.title,
          description: dto.description ?? null,
          startDate: start,
          endDate: end,
          timezone: dto.timezone,
          visibility: dto.visibility ?? Visibility.PRIVATE,
        },
      });
      await tx.tripMember.create({
        data: {
          tripId: created.id,
          userId: ownerId,
          role: 'OWNER',
          status: 'ACCEPTED',
        },
      });

      return created;
    });

    return trip;
  }

  async list(
    params: ListParams,
  ): Promise<{ data: TripResponse[]; total: number }> {
    const where: Prisma.TripWhereInput = { ownerId: params.ownerId };
    const orderBy: Prisma.TripOrderByWithRelationInput = {
      [params.sortField]: params.sortDir,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return { data, total };
  }

  private async requireOwner(
    tripId: string,
    userId: string,
  ): Promise<TripResponse> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
      });
    }
    if (trip.ownerId !== userId) {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'You are not the owner of this trip',
      });
    }
    return trip;
  }

  async getById(tripId: string, userId: string): Promise<TripResponse> {
    return this.requireOwner(tripId, userId);
  }

  async update(
    tripId: string,
    userId: string,
    dto: UpdateTripDto,
  ): Promise<TripResponse> {
    const trip = await this.requireOwner(tripId, userId);

    const startISO = dto.startDate ?? trip.startDate.toISOString();
    const endISO = dto.endDate ?? trip.endDate.toISOString();

    this.ensureDates(startISO, endISO);

    const updated = await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        timezone: dto.timezone ?? undefined,
        visibility: dto.visibility ?? undefined,
      },
    });
    return updated;
  }

  async delete(tripId: string, userId: string): Promise<void> {
    await this.requireOwner(tripId, userId);
    await this.prisma.trip.delete({ where: { id: tripId } });
  }
}
