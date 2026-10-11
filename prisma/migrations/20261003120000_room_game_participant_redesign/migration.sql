-- Room → Game → GameParticipant redesign (2026-10-03).
-- RoomMembership is replaced by GameParticipant (one row per person per
-- game), and the role mix moves from Room onto each Game. Safe to drop
-- data here: the dev database was empty when this was written.

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('LOBBY', 'ROLE_REVEAL', 'NIGHT', 'DAY', 'VOTE', 'GAME_OVER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MAFIA', 'DETECTIVE', 'DOCTOR', 'TOWN');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('MAFIA', 'TOWN');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ALIVE', 'DEAD');

-- CreateEnum
CREATE TYPE "GameEndReason" AS ENUM ('MAFIA_ELIMINATED', 'MAFIA_MAJORITY', 'ABORTED_ATTRITION', 'ABORTED_HOST');

-- DropForeignKey
ALTER TABLE "RoomMembership" DROP CONSTRAINT "RoomMembership_guestUserId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMembership" DROP CONSTRAINT "RoomMembership_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMembership" DROP CONSTRAINT "RoomMembership_userId_fkey";

-- DropIndex
DROP INDEX "Room_activeGameId_key";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "activeGameId",
DROP COLUMN "detectiveCount",
DROP COLUMN "doctorCount",
DROP COLUMN "mafiaCount",
DROP COLUMN "townCount";

-- DropTable
DROP TABLE "RoomMembership";

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "phase" "Phase" NOT NULL DEFAULT 'LOBBY',
    "round" INTEGER NOT NULL DEFAULT 1,
    "mafiaCount" INTEGER NOT NULL,
    "detectiveCount" INTEGER NOT NULL,
    "doctorCount" INTEGER NOT NULL,
    "townCount" INTEGER NOT NULL,
    "winner" "Team",
    "endReason" "GameEndReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "guestUserId" TEXT,
    "userId" TEXT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role",
    "status" "PlayerStatus" NOT NULL DEFAULT 'ALIVE',
    "diedAtRound" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_roomId_sequence_key" ON "Game"("roomId", "sequence");

-- CreateIndex
CREATE INDEX "GameParticipant_userId_idx" ON "GameParticipant"("userId");

-- CreateIndex
CREATE INDEX "GameParticipant_guestUserId_idx" ON "GameParticipant"("guestUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_guestUserId_key" ON "GameParticipant"("gameId", "guestUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_userId_key" ON "GameParticipant"("gameId", "userId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "GuestUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written rules below. Prisma's schema language can't express partial
-- indexes, CHECKs or triggers, so they live only here.
-- ---------------------------------------------------------------------------

-- 1. A room code is unique only among OPEN rooms, so two rooms created at
--    the same moment can't share a code, but closed rooms free theirs.
CREATE UNIQUE INDEX room_code_unique_while_open
  ON "Room" ("code") WHERE "closedAt" IS NULL;

-- 2. At most one unfinished game per room. This is what makes "the room's
--    current game" well-defined without storing a pointer on Room.
CREATE UNIQUE INDEX one_open_game_per_room
  ON "Game" ("roomId") WHERE "phase" <> 'GAME_OVER';

-- 3. One host per game. The host is set once and never swapped.
CREATE UNIQUE INDEX one_host_per_game
  ON "GameParticipant" ("gameId") WHERE "isHost";

-- 4. Every participant belongs to someone: a guest, a user, or both (a
--    guest row backfilled with userId at signup).
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_owner_present_check"
  CHECK ("guestUserId" IS NOT NULL OR "userId" IS NOT NULL);

-- 5. A result exists exactly when the game is over. winner stays nullable
--    at GAME_OVER because an aborted game has a reason but no winner.
ALTER TABLE "Game" ADD CONSTRAINT "Game_result_only_when_over_check"
  CHECK (
    ("phase" = 'GAME_OVER' AND "endReason" IS NOT NULL AND "endedAt" IS NOT NULL)
    OR
    ("phase" <> 'GAME_OVER' AND "winner" IS NULL AND "endReason" IS NULL AND "endedAt" IS NULL)
  );

-- 6. The role mix records what was actually dealt, so it may only change
--    while the game is still in LOBBY. Checks the OLD phase, so the single
--    update that starts the game (LOBBY → ROLE_REVEAL) is still allowed.
CREATE FUNCTION game_mix_locked_after_lobby() RETURNS trigger AS $$
BEGIN
  IF OLD."phase" <> 'LOBBY' AND
     (NEW."mafiaCount", NEW."detectiveCount", NEW."doctorCount", NEW."townCount")
       IS DISTINCT FROM
     (OLD."mafiaCount", OLD."detectiveCount", OLD."doctorCount", OLD."townCount")
  THEN
    RAISE EXCEPTION 'Game % has started; its role mix cannot change', OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_mix_locked
  BEFORE UPDATE OF "mafiaCount", "detectiveCount", "doctorCount", "townCount"
  ON "Game"
  FOR EACH ROW EXECUTE FUNCTION game_mix_locked_after_lobby();
