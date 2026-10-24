-- Per-game day and night lengths for the timers (decision record
-- 2026-10-18, Q4–Q6). The host picks the day length at room creation; the
-- night is fixed at 90 seconds for now but stored so it can become
-- configurable later.

-- Any game that already exists gets the "standard" 2-minute day. The default
-- is dropped straight after: every new game must say its day length.
ALTER TABLE "Game" ADD COLUMN "dayLengthInSeconds" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "nightLengthInSeconds" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "Game" ALTER COLUMN "dayLengthInSeconds" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Hand-written rules below. Prisma's schema language can't express CHECKs.
-- Not covered by the mix-lock trigger on purpose (Q10): no endpoint changes
-- a game's lengths after it is created.
-- ---------------------------------------------------------------------------

-- 1. Only the three day lengths the room-setup screen offers (Q4).
ALTER TABLE "Game" ADD CONSTRAINT "Game_day_length_check"
  CHECK ("dayLengthInSeconds" IN (60, 120, 180));

-- 2. A night always lasts some time. Its allowed values are settled when it
-- becomes configurable (Q6).
ALTER TABLE "Game" ADD CONSTRAINT "Game_night_length_positive_check"
  CHECK ("nightLengthInSeconds" > 0);
