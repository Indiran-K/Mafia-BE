import type {
  Game,
  GameParticipant,
  GuestUser,
  Room,
} from "../../generated/prisma/client";
import type { JoinRoomStatus } from "./rooms.enum";

// What the host chooses on the room-setup screen (decision record
// 2026-10-18, Q3–Q4). Field names match the Game columns, so it's saved
// onto the first game as-is. The night length isn't chosen yet (Q6).
export interface RoomSetup {
  mafiaCount: number;
  detectiveCount: number;
  doctorCount: number;
  townCount: number;
  dayLengthInSeconds: number;
}

export interface CreateRoomInput {
  guestToken: string;
  setup: RoomSetup;
}

// No displayName: the name comes from the guest row (decision record
// 2026-10-18, step 4).
export interface JoinRoomInput {
  code: string;
  guestToken: string;
}

// Only the two successes; every failure is thrown.
export interface JoinRoomResult {
  status: JoinRoomStatus;
  room: RoomWithCurrentGame;
}

export type GameWithParticipants = Game & { participants: GameParticipant[] };

// A room plus the one game that isn't GAME_OVER yet. Null between games
// (after game over, before the host presses "Play again"). Finished games
// are left out on purpose: the lobby screen only ever shows the live one.
export type RoomWithCurrentGame = Room & {
  currentGame: GameWithParticipants | null;
};

export type GuestUserRecord = GuestUser;
