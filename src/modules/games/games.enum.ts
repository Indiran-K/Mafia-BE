/** The ways a "Begin the game" request can end. The controller maps each to an HTTP status. */
export enum StartGameStatus {
  STARTED = "started",
  GAME_NOT_FOUND = "game_not_found",
  // Already begun, already over, or just expired as abandoned.
  NOT_IN_LOBBY = "not_in_lobby",
  NOT_HOST = "not_host",
  // The present player count doesn't fit the mix, or the mix itself isn't
  // playable (no mafia, mafia already equal the town).
  INVALID_ROLE_MIX = "invalid_role_mix",
}
