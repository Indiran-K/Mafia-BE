import type { Game } from "../../generated/prisma/client";
import type { StartGameStatus } from "./games.enum";

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

// STARTED returns the bare Game row — phase, startedAt — and deliberately
// no participants: their rows now hold everyone's secret role, and this
// response goes to the host. Each player learns only their own role from
// the per-player view at Role Reveal.
export type StartGameResult =
  | { status: StartGameStatus.STARTED; game: Game }
  | { status: StartGameStatus.GAME_NOT_FOUND }
  | { status: StartGameStatus.NOT_IN_LOBBY }
  | { status: StartGameStatus.NOT_HOST }
  // reason is validateRoleMix's own message, e.g. "Role mix assigns 5
  // roles but the room has 4 players." — shown to the host as-is.
  | { status: StartGameStatus.INVALID_ROLE_MIX; reason: string };
