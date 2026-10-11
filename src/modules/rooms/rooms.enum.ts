/** The ways a join request can end. The controller maps each to an HTTP status. */
export enum JoinRoomStatus {
  JOINED = "joined",
  ALREADY_JOINED = "already_joined",
  ROOM_FULL = "room_full",
  ROOM_NOT_FOUND = "room_not_found",
  // The room is open but its last game is over (or was just expired as
  // abandoned) and the host hasn't pressed "Play again" yet.
  NO_OPEN_GAME = "no_open_game",
  // The current game has already begun. Only people already in it may
  // reconnect; newcomers wait for the next game.
  GAME_IN_PROGRESS = "game_in_progress",
}
