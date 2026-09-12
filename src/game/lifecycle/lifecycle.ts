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
