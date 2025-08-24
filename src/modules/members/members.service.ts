import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus, Role } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { TripAccessService } from '../trips/trip-access.service';

export interface MemberView {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  status: MemberStatus;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}

  async listMembers(
    tripId: string,
    requesterId: string,
  ): Promise<MemberView[]> {
    await this.access.requireMinRole(tripId, requesterId, Role.EDITOR);

    const members = await this.prisma.tripMember.findMany({
      where: { tripId },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      status: member.status,
    }));
  }

  async updateRole(
    tripId: string,
    targetUserId: string,
    newRole: Role,
    requesterId: string,
  ): Promise<MemberView> {
    if (newRole === Role.OWNER) {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'Cannot assign OWNER via this endpoint',
      });
    }

    const requester = await this.access.requireMember(tripId, requesterId);
    if (requester.role !== 'OWNER') {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'Only owner can change roles',
      });
    }

    const member = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: targetUserId } },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!member)
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      });
    if (member.role === 'OWNER') {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'Cannot change role of an OWNER',
      });
    }

    const updated = await this.prisma.tripMember.update({
      where: { tripId_userId: { tripId, userId: targetUserId } },
      data: { role: newRole },
      include: { user: { select: { email: true, name: true } } },
    });

    return {
      userId: updated.userId,
      email: updated.user.email,
      name: updated.user.name,
      role: updated.role,
      status: updated.status,
    };
  }

  async removeMember(
    tripId: string,
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    const requester = await this.access.requireMember(tripId, requesterId);
    if (requester.role !== 'OWNER') {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'Only owner can remove members',
      });
    }

    const member = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: targetUserId } },
      select: { userId: true, role: true },
    });
    if (!member)
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      });
    if (member.role === 'OWNER') {
      throw new ConflictException({
        code: 'TRIP_FORBIDDEN',
        message: 'Cannot remove an OWNER',
      });
    }

    await this.prisma.tripMember.delete({
      where: { tripId_userId: { tripId, userId: targetUserId } },
    });
  }
}
