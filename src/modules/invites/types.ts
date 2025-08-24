import { InviteStatus, Role } from '@prisma/client';

export interface InviteView {
  id: string;
  tripId: string;
  email: string;
  role: Role;
  status: InviteStatus;
  token: string;
  expiresAt: Date;
  invitedBy: { userId: string; email: string };
  createdAt: Date;
  respondedAt: Date | null;
}

export interface MyInviteView {
  id: string;
  tripId: string;
  tripTitle: string;
  role: Role;
  status: InviteStatus;
  invitedByEmail: string;
  expiresAt: Date;
  createdAt: Date;
}
