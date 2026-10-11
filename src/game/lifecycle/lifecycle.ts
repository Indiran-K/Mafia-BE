import { ConnectionStatus, PlayerStatus } from "../enums/enums";
import type { Player } from "../interfaces/types";

/**
 * Below this many active players, an in-progress game aborts due to
 * attrition. Deliberately lower than the 5-to-start lobby minimum — a game
 * already underway only needs to keep going, not restart from scratch.
 */
export const MIN_ALIVE_PLAYERS = 4;

export function shouldAbortForAttrition(players: Player[]): boolean {
  const activePlayers = players.filter(
    (player) =>
      player.status === PlayerStatus.ALIVE &&
      player.connection !== ConnectionStatus.OFFLINE,
  );
  return activePlayers.length < MIN_ALIVE_PLAYERS;
}

// A game nobody has touched for this long is ended as ABANDONED the next
// time anyone touches its room (decision record 2026-10-03, Q16).
const GAME_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// True once a game has gone the full idle timeout with no activity, so a
// game whose players all vanished can't block its room forever. `now` is a
// parameter so tests can check the 29- and 31-minute edges without waiting.
export function isGameIdle(
  game: { lastActivityAt: Date },
  now: Date = new Date(),
): boolean {
  const idleForMs = now.getTime() - game.lastActivityAt.getTime();
  return idleForMs >= GAME_IDLE_TIMEOUT_MS;
}
