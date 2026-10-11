-- Stuck-game timeout (decision record 2026-10-03, Q16/Q17).
-- A game nobody has touched for 30 minutes is ended as ABANDONED the next
-- time anyone touches its room, so a crashed or deserted game can never
-- block the room forever.

-- AlterEnum
ALTER TYPE "GameEndReason" ADD VALUE 'ABANDONED';

-- AlterTable
-- Existing rows get "now", which simply starts their 30-minute clock fresh.
ALTER TABLE "Game" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
