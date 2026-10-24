import type { NightActionType } from "../../game/enums/enums";
import type { Game, GameParticipant } from "../../generated/prisma/client";
import type { SubmitNightActionStatus } from "./games.enum";

// Who a participant (or a room's creator) is, already resolved by the
// service. Maps one-to-one onto the two owner columns, so repositories
// never need to know about guest tokens or logins. A guest fills
// guestUserId (plus userId if that guest has signed up); a logged-in
// player fills only userId.
export interface ParticipantOwner {
  guestUserId: string | null;
  userId: string | null;
}

export interface StartGameInput {
  gameId: string;
  guestToken: string;
}

// The game plus everyone who has ever joined it. What the night flows load
// once the room lock is held.
export type GameWithParticipants = Game & { participants: GameParticipant[] };

export interface SubmitNightActionInput {
  gameId: string;
  guestToken: string;
  // Which night the phone is acting in (Q2 check 3).
  round: number;
  type: NightActionType;
  // null only for a skip.
  targetId: string | null;
}

// isMafia is the detective's answer (Q15), null for every other action.
// nightEnded tells a later caller (the Socket.io layer) that this confirm
// was the last one and the day has begun. It isn't sent to the phone.
export type SubmitNightActionResult =
  | { status: SubmitNightActionStatus.RECORDED; isMafia: boolean | null; nightEnded: boolean }
  | { status: SubmitNightActionStatus.ALREADY_RECORDED; isMafia: boolean | null };
