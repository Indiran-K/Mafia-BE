/** The roles a player can be dealt at the start of a game. */
export enum Role {
  MAFIA = "mafia",
  DOCTOR = "doctor",
  DETECTIVE = "detective",
  TOWN = "town",
}

/** Which side a player wins with, and which side won the game. */
export enum Team {
  MAFIA = "mafia",
  TOWN = "town",
}

/**
 * Where the game currently is.
 *
 * This is the single source of truth for the game's lifecycle — there is
 * deliberately no separate "status" field. Two overlapping fields would let
 * you represent impossible states like "ended, but still in the night phase".
 */
export enum Phase {
  LOBBY = "lobby",
  ROLE_REVEAL = "role_reveal",
  NIGHT = "night",
  DAY = "day",
  VOTE = "vote",
  GAME_OVER = "game_over",
}

/**
 * Whether a player is still in the game.
 *
 * Kept separate from `isConnected` — the two are independent. A dead player
 * can still be connected and watching, and a living player can drop off Wi-Fi.
 */
export enum PlayerStatus {
  ALIVE = "alive",
  DEAD = "dead",
}

/** What each acting role does during the night. */
export enum NightActionType {
  KILL = "kill",
  INVESTIGATE = "investigate",
  PROTECT = "protect",
  SKIP = "skip",
}

export enum ConnectionStatus {
  ONLINE = "online",
  RECONNECTING = "reconnecting",
  OFFLINE = "offline",
}
