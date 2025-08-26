import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { TripAccessService } from '../trips/trip-access.service';

import { CreateItemDto, ListItemsQueryDto, UpdateItemDto } from './dto';

import type { ItemResponse } from './types';

const AUTHOR_CAN_EDIT_DELETE = true as const;

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}

  private assertDates(startAt?: string, endAt?: string): void {
    if (startAt && Number.isNaN(new Date(startAt).getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid startAt',
      });
    }
    if (endAt && Number.isNaN(new Date(endAt).getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid endAt',
      });
    }
    if (startAt && endAt) {
      if (new Date(startAt).getTime() > new Date(endAt).getTime()) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'startAt must be before or equal to endAt',
        });
      }
    }
  }

  private async assertWithinTripRange(
    tripId: string,
    startAt?: string,
    endAt?: string,
  ): Promise<void> {
    if (!startAt && !endAt) return;
    const trip = await this.access.getTrip(tripId);
    const start = startAt
      ? new Date(startAt).getTime()
      : new Date(trip.startDate).getTime();
    const end = endAt
      ? new Date(endAt).getTime()
      : new Date(trip.endDate).getTime();

    if (
      start < new Date(trip.startDate).getTime() ||
      end > new Date(trip.endDate).getTime()
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Item datetime must be within trip range',
        details: { tripStart: trip.startDate, tripEnd: trip.endDate },
      });
    }
  }

  private toResponse(
    row: Prisma.ItemGetPayload<{
      include: { _count: { select: { votes: true } } };
    }>,
  ): ItemResponse {
    return {
      id: row.id,
      tripId: row.tripId,
      createdById: row.createdById,
      type: row.type,
      title: row.title,
      notes: row.notes ?? null,
      startAt: row.startAt ?? null,
      endAt: row.endAt ?? null,
      timezone: row.timezone,
      locationName: row.locationName ?? null,
      lat: row.lat !== null ? Number(row.lat) : null,
      lng: row.lng !== null ? Number(row.lng) : null,
      url: row.url ?? null,
      costCents: row.costCents ?? null,
      currency: row.currency ?? null,
      order: row.order,
      votesCount: row._count.votes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(
    tripId: string,
    userId: string,
    dto: CreateItemDto,
  ): Promise<ItemResponse> {
    await this.access.requireMinRole(tripId, userId, Role.EDITOR);

    this.assertDates(dto.startAt, dto.endAt);
    await this.assertWithinTripRange(tripId, dto.startAt, dto.endAt);

    const created = await this.prisma.item.create({
      data: {
        tripId,
        createdById: userId,
        type: dto.type,
        title: dto.title,
        notes: dto.notes ?? null,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        timezone: dto.timezone,
        locationName: dto.locationName ?? null,
        lat: typeof dto.lat === 'number' ? dto.lat : null,
        lng: typeof dto.lng === 'number' ? dto.lng : null,
        url: dto.url ?? null,
        costCents: typeof dto.costCents === 'number' ? dto.costCents : null,
        currency: dto.currency ?? null,
        order: typeof dto.order === 'number' ? dto.order : 0,
      },
      include: { _count: { select: { votes: true } } },
    });

    return this.toResponse(created);
  }

  async list(
    tripId: string,
    requesterId: string,
    q: ListItemsQueryDto,
  ): Promise<{
    data: ItemResponse[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    await this.access.requireMember(tripId, requesterId);

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const orderBy: Prisma.ItemOrderByWithRelationInput =
      q.sortField === 'votes'
        ? { votes: { _count: q.sortDir ?? 'asc' } }
        : { [q.sortField ?? 'startAt']: q.sortDir ?? 'asc' };

    const where: Prisma.ItemWhereInput = { tripId };

    if (q.date) {
      const dayStart = new Date(`${q.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${q.date}T23:59:59.999Z`);
      where.AND = [{ startAt: { lte: dayEnd } }, { endAt: { gte: dayStart } }];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { votes: true } } },
      }),
      this.prisma.item.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: { page, pageSize, total },
    };
  }

  private async requireItem(
    tripId: string,
    itemId: string,
  ): Promise<
    Prisma.ItemGetPayload<{ include: { _count: { select: { votes: true } } } }>
  > {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, tripId },
      include: { _count: { select: { votes: true } } },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: 'Item not found',
      });
    }
    return item;
  }

  private async ensureCanEdit(
    tripId: string,
    requesterId: string,
    item: { createdById: string },
  ): Promise<void> {
    try {
      await this.access.requireMinRole(tripId, requesterId, 'EDITOR'); // OWNER/EDITOR
    } catch {
      if (AUTHOR_CAN_EDIT_DELETE && item.createdById === requesterId) {
        return;
      }
      throw new ForbiddenException({
        code: 'ITEM_FORBIDDEN',
        message: 'Not allowed to edit this item',
      });
    }
  }

  async getById(
    tripId: string,
    requesterId: string,
    itemId: string,
  ): Promise<ItemResponse> {
    await this.access.requireMember(tripId, requesterId);
    const item = await this.requireItem(tripId, itemId);

    return this.toResponse(item);
  }

  async update(
    tripId: string,
    requesterId: string,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<ItemResponse> {
    const item = await this.requireItem(tripId, itemId);
    await this.ensureCanEdit(tripId, requesterId, item);

    this.assertDates(dto.startAt, dto.endAt);
    await this.assertWithinTripRange(
      tripId,
      dto.startAt ?? (item.startAt ? item.startAt.toISOString() : undefined),
      dto.endAt ?? (item.endAt ? item.endAt.toISOString() : undefined),
    );

    const updated = await this.prisma.item.update({
      where: { id: itemId },
      data: {
        type: dto.type ?? undefined,
        title: dto.title ?? undefined,
        notes: dto.notes ?? undefined,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        timezone: dto.timezone ?? undefined,
        locationName: dto.locationName ?? undefined,
        lat: typeof dto.lat === 'number' ? dto.lat : undefined,
        lng: typeof dto.lng === 'number' ? dto.lng : undefined,
        url: dto.url ?? undefined,
        costCents:
          typeof dto.costCents === 'number' ? dto.costCents : undefined,
        currency: dto.currency ?? undefined,
        order: typeof dto.order === 'number' ? dto.order : undefined,
      },
      include: { _count: { select: { votes: true } } },
    });

    return this.toResponse(updated);
  }

  async delete(
    tripId: string,
    requesterId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.requireItem(tripId, itemId);
    await this.ensureCanEdit(tripId, requesterId, item);
    await this.prisma.item.delete({ where: { id: itemId } });
  }
}
