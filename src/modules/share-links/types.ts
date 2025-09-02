export interface ShareLinkResponse {
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
}
