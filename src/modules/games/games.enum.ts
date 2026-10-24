/**
 * What a transaction returns instead of throwing when it has just saved a
 * game as ABANDONED (decision record 2026-10-18 validation/errors/DTOs, Q7).
 * A throw inside the transaction would roll that save back, so the service
 * throws "Game was abandoned." only after the commit. Used by join and Begin.
 */
export enum LobbyExpiry {
  GAME_ABANDONED = "game_abandoned",
}

/**
 * The two successes of a night confirm. Every failure is thrown by the
 * service as an HttpException, so the controller only tells these apart.
 */
export enum SubmitNightActionStatus {
  RECORDED = "recorded", // 201
  // The exact same confirm again, e.g. a retry on a bad network (Q1). 200.
  ALREADY_RECORDED = "already_recorded",
}
