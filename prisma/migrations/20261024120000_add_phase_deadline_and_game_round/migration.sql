-- Phase deadline and per-round results (decision record 2026-10-24, Q5–Q10,
-- Q13). Game.phaseEndsAt holds the current phase's deadline; GameRound holds
-- each round's results, written once.

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('killed', 'saved');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "phaseEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GameRound" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "mafiaTargetId" TEXT,
    "mafiaTargetStatus" "TargetStatus",
    "doctorProtectedId" TEXT,
    "detectiveTargetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_gameId_round_key" ON "GameRound"("gameId", "round");

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameId_mafiaTargetId_fkey" FOREIGN KEY ("gameId", "mafiaTargetId") REFERENCES "GameParticipant"("gameId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameId_doctorProtectedId_fkey" FOREIGN KEY ("gameId", "doctorProtectedId") REFERENCES "GameParticipant"("gameId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameId_detectiveTargetId_fkey" FOREIGN KEY ("gameId", "detectiveTargetId") REFERENCES "GameParticipant"("gameId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written rules below. Prisma's schema language can't express CHECKs.
-- The mix-lock trigger only compares the four count columns, so writing
-- phaseEndsAt after Begin is allowed; no trigger change.
-- ---------------------------------------------------------------------------

-- 1. Games already at night or day get a deadline counted from now. Must run
-- before the CHECK below, or adding it fails on those rows.
UPDATE "Game" SET "phaseEndsAt" = now() + make_interval(secs => "nightLengthInSeconds")
  WHERE "phase" = 'night';
UPDATE "Game" SET "phaseEndsAt" = now() + make_interval(secs => "dayLengthInSeconds")
  WHERE "phase" = 'day';

-- 2. A night or day always has a deadline, so the code never has to guess
-- what a missing one means.
ALTER TABLE "Game" ADD CONSTRAINT "Game_timed_phase_has_deadline_check"
  CHECK ("phase" NOT IN ('night', 'day') OR "phaseEndsAt" IS NOT NULL);

-- 3. Rounds start at 1, the same as Game.round.
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_round_positive_check"
  CHECK ("round" >= 1);

-- 4. A target always has a status, and a status always has a target.
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_target_has_status_check"
  CHECK (("mafiaTargetId" IS NULL) = ("mafiaTargetStatus" IS NULL));

