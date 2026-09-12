import { PlayerStatus } from "../enums/enums";
import type { Player } from "../interfaces/types";

// Shared by mostAccused and allReady so both work from the same tally
// instead of re-scanning accusations with their own separate loop. A
// player only counts as "accusing" if they currently have a non-null
// accusation — silence, a withdrawn accusation, and an explicit skip are
// all the same thing here.
function tallyAccusations(
  accusations: Record<string, string | null>,
  livingPlayerIds: string[],
): { accusationCountByTargetId: Record<string, number>; accusingPlayerCount: number } {
  const accusationCountByTargetId: Record<string, number> = {};
  let accusingPlayerCount = 0;
  for (const livingPlayerId of livingPlayerIds) {
    const accusedPlayerId = accusations[livingPlayerId];
    if (accusedPlayerId === null || accusedPlayerId === undefined) {
      continue;
    }
    accusingPlayerCount++;
    accusationCountByTargetId[accusedPlayerId] =
      (accusationCountByTargetId[accusedPlayerId] || 0) + 1;
  }
  return { accusationCountByTargetId, accusingPlayerCount };
}

// Finds who the town is putting on trial. Two majority checks happen in
// sequence:
//   1. Strictly more than half of ALL living players must be actively
//      accusing someone right now, or the day goes straight to "no trial" —
//      a quiet or undecided majority can block a trial the same way a
//      silent mafia majority blocks a kill.
//   2. Among the players who ARE accusing, whichever suspect(s) have the
//      most accusations move to confession. Ties are returned together
//      (e.g. two suspects tied at 2 accusations each both go to
//      confession) rather than picked apart here — resolving a tie is the
//      voting phase's job, not this function's.
// Empty array always means "no trial," whether that's because the
// accusing-gate failed or because literally no one accused anyone.
export function mostAccused(
  accusations: Record<string, string | null>,
  livingPlayerIds: string[],
): string[] {
  const { accusationCountByTargetId, accusingPlayerCount } = tallyAccusations(
    accusations,
    livingPlayerIds,
  );

  const accusingMajorityThreshold = livingPlayerIds.length / 2;
  if (accusingPlayerCount <= accusingMajorityThreshold) {
    return [];
  }

  // Single pass: track the current max count, resetting the tied-leaders
  // list whenever a new strict max appears, and appending to it on ties.
  let highestAccusationCount = 0;
  let mostAccusedTargetIds: string[] = [];
  for (const targetId of Object.keys(accusationCountByTargetId)) {
    const count = accusationCountByTargetId[targetId]!;
    if (count > highestAccusationCount) {
      highestAccusationCount = count;
      mostAccusedTargetIds = [targetId];
    } else if (count === highestAccusationCount) {
      mostAccusedTargetIds.push(targetId);
    }
  }
  return mostAccusedTargetIds;
}

// A player only counts as "ready" by having actually accused someone —
// there's no separate ready flag independent of accusing. This checks
// whether more than half of all living players have reached that state,
// the same condition mostAccused's gate checks; kept as its own function
// so the Day-phase timer logic can ask "can we advance early?" without
// re-deriving the full accusation tally.
export function allReady(
  accusations: Record<string, string | null>,
  livingPlayerIds: string[],
): boolean {
  const { accusingPlayerCount } = tallyAccusations(accusations, livingPlayerIds);
  return accusingPlayerCount > livingPlayerIds.length / 2;
}

// The actual Day -> Confession/Vote gate, checked either when the
// Discussion+Accusation timer expires or (as an early-advance optimization)
// whenever a new accusation might have just crossed the threshold. Returns
// the suspect(s) heading to confession, or an empty array if the day
// resolves as "no trial" and Vote should be skipped entirely.
export function canProceedToVote(
  accusations: Record<string, string | null>,
  players: Player[],
): string[] {
  const livingPlayerIds = players
    .filter((player) => player.status === PlayerStatus.ALIVE)
    .map((player) => player.id);
  return mostAccused(accusations, livingPlayerIds);
}
