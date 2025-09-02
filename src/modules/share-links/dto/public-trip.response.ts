import type { ItemType, Prisma } from '@prisma/client';

export interface PublicTripSummary {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export interface PublicItem {
  id: string;
  type: ItemType;
  title: string;
  notes: string | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string;
  locationName: string | null;
  lat: number | Prisma.Decimal | null;
  lng: number | Prisma.Decimal | null;
  url: string | null;
  order: number;
  votesCount: number;
}

export interface PublicTripPayload {
  trip: PublicTripSummary;
  items: PublicItem[];
}
