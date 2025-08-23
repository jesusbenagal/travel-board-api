-- DropForeignKey
ALTER TABLE "public"."TripMember" DROP CONSTRAINT "TripMember_tripId_fkey";

-- AddForeignKey
ALTER TABLE "public"."TripMember" ADD CONSTRAINT "TripMember_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
