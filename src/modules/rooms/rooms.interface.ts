import type { Game, GameParticipant, GuestUser, Room } from "../../generated/prisma/client";
import type { JoinRoomStatus } from "./rooms.enum";

export interface CreateRoomInput {
  guestToken: string;
  displayName: string;
}

export interface JoinRoomInput {
  code: string;
  guestToken: string;
  displayName: string;
}

export type JoinRoomResult =
  | { status: JoinRoomStatus.JOINED; room: RoomWithCurrentGame }
  | { status: JoinRoomStatus.ALREADY_JOINED; room: RoomWithCurrentGame }
  | { status: JoinRoomStatus.ROOM_FULL }
  | { status: JoinRoomStatus.ROOM_NOT_FOUND }
  | { status: JoinRoomStatus.NO_OPEN_GAME }
  | { status: JoinRoomStatus.GAME_IN_PROGRESS };

export type GameWithParticipants = Game & { participants: GameParticipant[] };

// A room plus the one game that isn't GAME_OVER yet. Null between games
// (after game over, before the host presses "Play again"). Finished games
// are left out on purpose: the lobby screen only ever shows the live one.
export type RoomWithCurrentGame = Room & { currentGame: GameWithParticipants | null };

// Seed values for the first game's role mix when a room is created, before
// any players beyond the host exist. The host edits these later from the
// Role Mix editor; validateRoleMix (game/roles/roles.ts) is what checks a
// mix is actually playable once the real player count is known.
export interface StartingRoleMix {
  mafiaCount: number;
  detectiveCount: number;
  doctorCount: number;
  townCount: number;
}

export type GuestUserRecord = GuestUser;
