import { ItemType } from '@prisma/client';

export interface ItemResponse {
  id: string;
  tripId: string;
  createdById: string;
  type: ItemType;
  title: string;
  notes: string | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  costCents: number | null;
  currency: string | null;
  order: number;
  votesCount: number;
  createdAt: Date;
  updatedAt: Date;
}
