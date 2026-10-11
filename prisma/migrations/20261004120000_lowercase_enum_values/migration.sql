-- Hand-written (decision record Q21): enum values become lowercase.
--
-- Prisma's generated version rebuilds each type and converts columns via
-- text, which fails here: existing 'LOBBY' rows have no match in the new
-- type, and the partial index and CHECK depend on the old type. RENAME VALUE
-- renames in place instead. Rows, column defaults, the one_open_game_per_room
-- index and Game_result_only_when_over_check all follow on their own, because
-- Postgres stores enum constants by internal id, not by their text.

ALTER TYPE "Phase" RENAME VALUE 'LOBBY' TO 'lobby';
ALTER TYPE "Phase" RENAME VALUE 'ROLE_REVEAL' TO 'role_reveal';
ALTER TYPE "Phase" RENAME VALUE 'NIGHT' TO 'night';
ALTER TYPE "Phase" RENAME VALUE 'DAY' TO 'day';
ALTER TYPE "Phase" RENAME VALUE 'VOTE' TO 'vote';
ALTER TYPE "Phase" RENAME VALUE 'GAME_OVER' TO 'game_over';

ALTER TYPE "Role" RENAME VALUE 'MAFIA' TO 'mafia';
ALTER TYPE "Role" RENAME VALUE 'DETECTIVE' TO 'detective';
ALTER TYPE "Role" RENAME VALUE 'DOCTOR' TO 'doctor';
ALTER TYPE "Role" RENAME VALUE 'TOWN' TO 'town';

ALTER TYPE "Team" RENAME VALUE 'MAFIA' TO 'mafia';
ALTER TYPE "Team" RENAME VALUE 'TOWN' TO 'town';

ALTER TYPE "PlayerStatus" RENAME VALUE 'ALIVE' TO 'alive';
ALTER TYPE "PlayerStatus" RENAME VALUE 'DEAD' TO 'dead';

ALTER TYPE "GameEndReason" RENAME VALUE 'MAFIA_ELIMINATED' TO 'mafia_eliminated';
ALTER TYPE "GameEndReason" RENAME VALUE 'MAFIA_MAJORITY' TO 'mafia_majority';
ALTER TYPE "GameEndReason" RENAME VALUE 'ABORTED_ATTRITION' TO 'aborted_attrition';
ALTER TYPE "GameEndReason" RENAME VALUE 'ABORTED_HOST' TO 'aborted_host';
ALTER TYPE "GameEndReason" RENAME VALUE 'ABANDONED' TO 'abandoned';

-- The one thing that does NOT follow: a plpgsql function body is stored as
-- plain text, so its 'LOBBY' would never match again. Same logic, new value.
CREATE OR REPLACE FUNCTION game_mix_locked_after_lobby() RETURNS trigger AS $$
BEGIN
  IF OLD."phase" <> 'lobby' AND
     (NEW."mafiaCount", NEW."detectiveCount", NEW."doctorCount", NEW."townCount")
       IS DISTINCT FROM
     (OLD."mafiaCount", OLD."detectiveCount", OLD."doctorCount", OLD."townCount")
  THEN
    RAISE EXCEPTION 'Game % has started; its role mix cannot change', OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
