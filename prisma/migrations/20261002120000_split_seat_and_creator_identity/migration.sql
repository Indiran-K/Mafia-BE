-- Hand-edited from `prisma migrate diff`. A seat or room creator is now owned
-- by EITHER a guest id OR a user id (see schema.prisma comments).

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_createdById_fkey";

-- AlterTable
-- Rename instead of Prisma's DROP + ADD, so the existing guest-creator ids are
-- kept rather than thrown away.
ALTER TABLE "Room" RENAME COLUMN "createdById" TO "createdByGuestUserId";
ALTER TABLE "Room" ALTER COLUMN "createdByGuestUserId" DROP NOT NULL;
ALTER TABLE "Room" ADD COLUMN "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "RoomMembership" ALTER COLUMN "guestUserId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RoomMembership_roomId_userId_key" ON "RoomMembership"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_createdByGuestUserId_fkey" FOREIGN KEY ("createdByGuestUserId") REFERENCES "GuestUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added. Prisma's schema language can't express these. Every room and
-- every seat must have at least one owner.
ALTER TABLE "Room" ADD CONSTRAINT "Room_creator_present_check"
  CHECK ("createdByGuestUserId" IS NOT NULL OR "createdByUserId" IS NOT NULL);

ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_owner_present_check"
  CHECK ("guestUserId" IS NOT NULL OR "userId" IS NOT NULL);
