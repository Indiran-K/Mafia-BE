import { ConnectionStatus } from "../enums/enums";
import type { Player } from "../interfaces/types";

// Finds who should take over as host when the current host disconnects —
// picks the longest-tenured still-online player so the new host is someone
// who's been in the room the whole time, not a recent joiner.
export function selectMigrationCandidate(
  players: Player[],
  currentHostId: string,
): Player | null {
  const eligiblePlayers = players.filter(
    (player) =>
      player.id !== currentHostId &&
      player.connection === ConnectionStatus.ONLINE,
  );
  if (eligiblePlayers.length === 0) {
    return null;
  }
  return eligiblePlayers.reduce((longestTenured, candidate) =>
    candidate.joinedAt < longestTenured.joinedAt ? candidate : longestTenured,
  );
}

// Applies a host-migration decision to the player list — moves the isHost
// flag off the old host and onto the chosen candidate.
export function migrateHost(players: Player[], newHostId: string): Player[] {
  return players.map((player) => ({
    ...player,
    isHost: player.id === newHostId,
  }));
}
