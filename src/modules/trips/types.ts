export interface TripResponse {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  timezone: string;
  visibility: 'PRIVATE' | 'LINK';
  createdAt: Date;
  updatedAt: Date;
}
