-- NightAction (Task 9, decision record 2026-10-11). One confirmed action per
-- player per night. Actor and target are tied to the same game by composite
-- foreign keys (Q18).

-- CreateEnum
CREATE TYPE "NightActionType" AS ENUM ('kill', 'investigate', 'protect', 'skip');

-- CreateTable
CREATE TABLE "NightAction" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "NightActionType" NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NightAction_gameId_round_idx" ON "NightAction"("gameId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "NightAction_gameId_round_actorId_key" ON "NightAction"("gameId", "round", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_id_key" ON "GameParticipant"("gameId", "id");

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_gameId_actorId_fkey" FOREIGN KEY ("gameId", "actorId") REFERENCES "GameParticipant"("gameId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_gameId_targetId_fkey" FOREIGN KEY ("gameId", "targetId") REFERENCES "GameParticipant"("gameId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written rules below. Prisma's schema language can't express CHECKs.
-- ---------------------------------------------------------------------------

-- 1. A skip has no target, and every other action has exactly one (Q5).
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_skip_has_no_target_check"
  CHECK (("type" = 'skip') = ("targetId" IS NULL));

-- 2. Rounds start at 1, the same as Game.round.
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_round_positive_check"
  CHECK ("round" >= 1);

