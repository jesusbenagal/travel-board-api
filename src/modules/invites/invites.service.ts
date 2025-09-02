import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InviteStatus, Role, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { TripAccessService } from '../trips/trip-access.service';

import { CreateInviteDto } from './dto/create-invite.dto';
import type {
  PaginationMeta,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';

import type { InviteView, MyInviteView } from './types';

function base64url(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}

  private generateToken(): string {
    return base64url(randomBytes(24));
  }

  async createInvite(
    tripId: string,
    requesterId: string,
    dto: CreateInviteDto,
  ): Promise<InviteView> {
    const member = await this.access.requireMember(tripId, requesterId);
    if (member.role === 'EDITOR' && dto.role !== 'VIEWER') {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'Editors can only invite as VIEWER',
      });
    }

    const email = dto.email.trim().toLowerCase();

    // ya es miembro?
    const existingMember = await this.prisma.tripMember.findFirst({
      where: { tripId, user: { email } },
      select: { userId: true },
    });
    if (existingMember) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: 'User is already a member',
        details: { email: 'already_member' },
      });
    }

    const now = new Date();
    const token = this.generateToken();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    // ←––– PRECHECK por clave única (tripId,email)
    const existing = await this.prisma.invite.findUnique({
      where: { tripId_email: { tripId, email } },
      include: { invitedBy: { select: { id: true, email: true } } },
    });

    if (existing) {
      const isExpired = existing.expiresAt.getTime() < now.getTime();
      const isPending = existing.status === InviteStatus.PENDING;

      if (isPending && !isExpired) {
        // conflicto controlado
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: 'Invite already pending',
          details: { email: 'invite_pending' },
        });
      }

      // reciclar: reabrimos como PENDING y renovamos token/expiry
      const updated = await this.prisma.invite.update({
        where: { id: existing.id },
        data: {
          status: InviteStatus.PENDING,
          token,
          expiresAt,
          respondedAt: null,
          invitedById: requesterId,
          role: dto.role, // permite cambiar rol al re-invitar
        },
        include: { invitedBy: { select: { id: true, email: true } } },
      });

      return {
        id: updated.id,
        tripId: updated.tripId,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        token: updated.token,
        expiresAt: updated.expiresAt,
        invitedBy: {
          userId: updated.invitedBy.id,
          email: updated.invitedBy.email,
        },
        createdAt: updated.createdAt,
        respondedAt: updated.respondedAt,
      };
    }

    // creación normal
    try {
      const created = await this.prisma.invite.create({
        data: {
          tripId,
          invitedById: requesterId,
          email,
          role: dto.role,
          status: InviteStatus.PENDING,
          token,
          expiresAt,
        },
        include: { invitedBy: { select: { id: true, email: true } } },
      });

      return {
        id: created.id,
        tripId: created.tripId,
        email: created.email,
        role: created.role,
        status: created.status,
        token: created.token,
        expiresAt: created.expiresAt,
        invitedBy: {
          userId: created.invitedBy.id,
          email: created.invitedBy.email,
        },
        createdAt: created.createdAt,
        respondedAt: created.respondedAt,
      };
    } catch (e) {
      // Fallback por carrera: si otro creó al mismo tiempo
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: 'Invite already pending',
          details: { email: 'invite_pending' },
        });
      }
      throw e;
    }
  }

  async myInvites(
    email: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResponse<MyInviteView>> {
    const where: Prisma.InviteWhereInput = { email: email.toLowerCase() };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invite.findMany({
        where,
        include: {
          trip: { select: { title: true } },
          invitedBy: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invite.count({ where }),
    ]);

    const data: MyInviteView[] = rows.map((r) => ({
      id: r.id,
      tripId: r.tripId,
      tripTitle: r.trip.title,
      role: r.role,
      status: r.status,
      invitedByEmail: r.invitedBy.email,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));

    const pagination: PaginationMeta = { page, pageSize, total };
    return { data, pagination };
  }

  async acceptInvite(
    inviteId: string,
    userId: string,
  ): Promise<{ tripId: string; role: Role; status: InviteStatus }> {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        trip: { select: { id: true } },
        invitedBy: { select: { id: true } },
      },
    });

    if (!invite)
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Invite not found',
      });

    // El usuario autenticado debe tener el mismo email que el invite
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'INVITE_FORBIDDEN',
        message: 'Invite email does not match authenticated user',
      });
    }

    // Expirado o ya aceptado
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_ACCEPTED',
        message: 'Invite already accepted',
      });
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: 'Invite expired',
      });
    }

    // Crea membresía si no existe y marca aceptado
    await this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId: invite.tripId, userId } },
      });

      if (!existingMember) {
        await tx.tripMember.create({
          data: {
            tripId: invite.tripId,
            userId,
            role: invite.role,
            status: 'ACCEPTED',
          },
        });
      }

      await tx.invite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.ACCEPTED, respondedAt: new Date() },
      });
    });

    return {
      tripId: invite.tripId,
      role: invite.role,
      status: InviteStatus.ACCEPTED,
    };
  }

  async declineInvite(
    inviteId: string,
    userId: string,
  ): Promise<{ tripId: string; status: InviteStatus }> {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!invite)
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Invite not found',
      });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'INVITE_FORBIDDEN',
        message: 'Invite email does not match authenticated user',
      });
    }

    if (invite.status === InviteStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_ACCEPTED',
        message: 'Invite already accepted',
      });
    }

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.DECLINED, respondedAt: new Date() },
    });

    return { tripId: invite.tripId, status: InviteStatus.DECLINED };
  }
}
