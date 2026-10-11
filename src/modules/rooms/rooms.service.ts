import { getOrCreateGuest } from "../../accounts/account-service";
import { lockOpenRoomByCode } from "../../db/room-lock";
import { runInTransaction } from "../../db/transaction";
import { Phase } from "../../game/enums/enums";
import { isGameIdle } from "../../game/lifecycle/lifecycle";
import type { Game } from "../../generated/prisma/client";
import type { ParticipantOwner } from "../games/games.interface";
import { markGameAbandoned } from "../games/games.repository";
import { participantBelongsTo } from "../games/games.service";
import { JoinRoomStatus } from "./rooms.enum";
import type {
  CreateRoomInput,
  JoinRoomInput,
  JoinRoomResult,
  RoomWithCurrentGame,
  StartingRoleMix,
} from "./rooms.interface";
import {
  findOpenRoomByCode,
  findRoomWithCurrentGame,
  insertParticipant,
  insertRoomWithFirstGame,
  isRoomCodeInUse,
  reactivateParticipant,
} from "./rooms.repository";

// The first game's lobby has only the host when the room is created, so
// this is just a starting point the host can edit later from the Role Mix
// editor — not a validated final mix (that's validateRoleMix's job, once
// real player counts exist).
const STARTING_ROLE_MIX: StartingRoleMix = {
  mafiaCount: 1,
  detectiveCount: 1,
  doctorCount: 1,
  townCount: 2,
};

// Excludes 0/O and 1/I — players read these aloud to each other over voice chat.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Keeps drawing until it finds a code no open room is using.
async function generateRoomCode(): Promise<string> {
  while (true) {
    const code = randomRoomCode();
    if (!(await isRoomCodeInUse(code))) return code;
  }
}

// Works out who is asking, in the shape the repository stores. Guests only
// for now — a logged-in player will resolve to { guestUserId: null, userId }
// once a login endpoint exists. If this guest has already signed up, their
// userId rides along so their games line up with their account.
async function resolveGuestParticipantOwner(
  guestToken: string,
  displayName: string,
): Promise<ParticipantOwner> {
  const guest = await getOrCreateGuest(guestToken, displayName);
  return { guestUserId: guest.id, userId: guest.userId };
}

export async function createRoom(
  input: CreateRoomInput,
): Promise<RoomWithCurrentGame> {
  const host = await resolveGuestParticipantOwner(
    input.guestToken,
    input.displayName,
  );
  const code = await generateRoomCode();
  return insertRoomWithFirstGame(code, host, STARTING_ROLE_MIX);
}

// Codes are stored uppercase with no spaces. Anything a player types is
// cleaned this way before lookup, so "abc123 " still finds ABC123.
function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function getOpenRoomByCode(
  code: string,
): Promise<RoomWithCurrentGame | null> {
  return findOpenRoomByCode(normalizeRoomCode(code));
}

// Capacity is the game's role mix — one role per player.
function capacityOf(
  game: Pick<Game, "mafiaCount" | "detectiveCount" | "doctorCount" | "townCount">,
): number {
  return game.mafiaCount + game.detectiveCount + game.doctorCount + game.townCount;
}

// Adds a guest to a room's open lobby, safe under simultaneous joins. Every
// check runs inside one transaction that holds the room lock (see
// db/room-lock.ts), so two joins can't both see one free seat and both take
// it. The order matters: "already in" is checked before "game started" and
// "full", so a player reconnecting mid-game or to a full lobby gets back in.
export async function joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
  const player = await resolveGuestParticipantOwner(
    input.guestToken,
    input.displayName,
  );
  const code = normalizeRoomCode(input.code);

  return runInTransaction(async (tx): Promise<JoinRoomResult> => {
    const lockedRoomId = await lockOpenRoomByCode(tx, code);
    if (!lockedRoomId) return { status: JoinRoomStatus.ROOM_NOT_FOUND };

    const room = await findRoomWithCurrentGame(tx, lockedRoomId);
    const game = room.currentGame;
    if (!game) return { status: JoinRoomStatus.NO_OPEN_GAME };
    // Expiry first, like every lobby write (decision record 2026-10-03, Q16).
    if (isGameIdle(game)) {
      await markGameAbandoned(tx, game.id);
      return { status: JoinRoomStatus.NO_OPEN_GAME };
    }

    // A player has at most one row per game (unique constraints), kept even
    // after they leave. Found + still in → reconnect, in any phase. Found +
    // left → a rejoin: they go through the checks like anyone else, and
    // their old row is reused, since a second row for them isn't allowed.
    const existingParticipant = game.participants.find((participant) =>
      participantBelongsTo(participant, player),
    );
    if (existingParticipant && existingParticipant.leftAt === null) {
      return { status: JoinRoomStatus.ALREADY_JOINED, room };
    }

    // Newcomers (and anyone who left) can only enter before "Begin the
    // game". Letting someone back in mid-game is part of the parked
    // "leaving mid-game" discussion.
    if (game.phase !== Phase.LOBBY) {
      return { status: JoinRoomStatus.GAME_IN_PROGRESS };
    }

    // `>=`, not `===`: the Role Mix editor must never let the mix drop below
    // the present count, but if a bug ever lets it, `===` would stop
    // matching and wave everyone in. `>=` still blocks.
    const presentCount = game.participants.filter(
      (participant) => participant.leftAt === null,
    ).length;
    if (presentCount >= capacityOf(game)) {
      return { status: JoinRoomStatus.ROOM_FULL };
    }

    const gameAfterJoin = existingParticipant
      ? await reactivateParticipant(tx, game.id, existingParticipant.id)
      : await insertParticipant(tx, game.id, player);
    return {
      status: JoinRoomStatus.JOINED,
      room: { ...room, currentGame: gameAfterJoin },
    };
  });
}
