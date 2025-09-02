import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { TripAccessService } from '../trips/trip-access.service';

import { generateSlug } from '../../common/utils/slug.util';

import { CreateShareLinkDto } from './dto/create-share-link.dto';

import type { ShareLinkResponse } from './types';

@Injectable()
export class ShareLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}

  private toResponse(row: {
    id: string;
    tripId: string;
    slug: string;
    isActive: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    uses: number;
    note: string | null;
    createdAt: Date;
    revokedAt: Date | null;
  }): ShareLinkResponse {
    return {
      id: row.id,
      tripId: row.tripId,
      slug: row.slug,
      isActive: row.isActive,
      expiresAt: row.expiresAt,
      maxUses: row.maxUses,
      uses: row.uses,
      note: row.note,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }

  async create(
    tripId: string,
    requesterId: string,
    dto: CreateShareLinkDto,
  ): Promise<ShareLinkResponse> {
    await this.access.requireMinRole(tripId, requesterId, 'OWNER');

    if (dto.expiresAt) {
      const d = new Date(dto.expiresAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid expiresAt',
        });
      }
      if (d.getTime() <= Date.now()) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'expiresAt must be in the future',
        });
      }
    }

    const slug = generateSlug(16);
    const created = await this.prisma.shareLink.create({
      data: {
        tripId,
        createdById: requesterId,
        slug,
        isActive: true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxUses: typeof dto.maxUses === 'number' ? dto.maxUses : null,
        note: dto.note ?? null,
      },
    });

    return this.toResponse(created);
  }

  async list(
    tripId: string,
    requesterId: string,
  ): Promise<ShareLinkResponse[]> {
    await this.access.requireMinRole(tripId, requesterId, 'OWNER');
    const rows = await this.prisma.shareLink.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => this.toResponse(r));
  }

  async revoke(
    tripId: string,
    requesterId: string,
    linkId: string,
  ): Promise<void> {
    await this.access.requireMinRole(tripId, requesterId, 'OWNER');
    const link = await this.prisma.shareLink.findFirst({
      where: { id: linkId, tripId },
    });
    if (!link)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'ShareLink not found',
      });
    if (!link.isActive) return;

    await this.prisma.shareLink.update({
      where: { id: linkId },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async resolveSlug(slug: string): Promise<{ tripId: string }> {
    const link = await this.prisma.shareLink.findUnique({ where: { slug } });
    if (!link || !link.isActive) {
      throw new NotFoundException({
        code: 'SHARE_INVALID',
        message: 'Share link not found',
      });
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException({
        code: 'SHARE_EXPIRED',
        message: 'Share link expired',
      });
    }
    if (typeof link.maxUses === 'number' && link.uses >= link.maxUses) {
      throw new ForbiddenException({
        code: 'SHARE_MAXED',
        message: 'Share link usage exceeded',
      });
    }

    await this.prisma.shareLink.update({
      where: { id: link.id },
      data: { uses: { increment: 1 } },
    });

    return { tripId: link.tripId };
  }
}
