import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus, Role, Trip } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface TripMembership {
  tripId: string;
  userId: string;
  role: Role;
  status: MemberStatus;
}

@Injectable()
export class TripAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private static roleRank(role: Role): number {
    switch (role) {
      case Role.VIEWER:
        return 1;
      case Role.EDITOR:
        return 2;
      case Role.OWNER:
        return 3;
      default:
        return 0;
    }
  }

  async getTrip(tripId: string): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({
      where: {
        id: tripId,
      },
    });

    if (!trip) {
      throw new NotFoundException(`Trip with id ${tripId} not found`);
    }

    return trip;
  }

  async getMembership(
    tripId: string,
    userId: string,
  ): Promise<TripMembership | null> {
    const member = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: { tripId: true, userId: true, role: true, status: true },
    });
    return member ?? null;
  }

  async requireMember(tripId: string, userId: string): Promise<TripMembership> {
    const member = await this.getMembership(tripId, userId);

    if (!member) {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: 'Not a member of this trip',
      });
    }
    return member;
  }

  async requireMinRole(
    tripId: string,
    userId: string,
    min: Role,
  ): Promise<TripMembership> {
    const member = await this.requireMember(tripId, userId);

    const ok =
      TripAccessService.roleRank(member.role) >=
      TripAccessService.roleRank(min);
    if (!ok) {
      throw new ForbiddenException({
        code: 'TRIP_FORBIDDEN',
        message: `Requires role ${min}`,
      });
    }
    return member;
  }

  isOwner(member: TripMembership): boolean {
    return member.role === 'OWNER';
  }
}
