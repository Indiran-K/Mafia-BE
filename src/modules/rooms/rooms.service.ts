import { HttpStatus } from "../../common/enums/http-status.enum";
import { HttpException } from "../../common/exceptions";
import { lockOpenRoomByCode } from "../../db/room-lock";
import { runInTransaction } from "../../db/transaction";
import { Phase } from "../../game/enums/enums";
import { isGameIdle } from "../../game/lifecycle/lifecycle";
import { validateRoleMix } from "../../game/roles/roles";
import type { Game } from "../../generated/prisma/client";
import { LobbyExpiry } from "../games/games.enum";
import type { ParticipantOwner } from "../games/games.interface";
import { markGameAbandoned } from "../games/games.repository";
import {
  GAME_ABANDONED_MESSAGE,
  participantBelongsTo,
  roleMixOf,
} from "../games/games.service";
import { findGuestByToken } from "../guests/guests.service";
import { JoinRoomStatus } from "./rooms.enum";
import type {
  CreateRoomInput,
  JoinRoomInput,
  JoinRoomResult,
  RoomWithCurrentGame,
} from "./rooms.interface";
import {
  findOpenRoomByCode,
  findRoomWithCurrentGame,
  insertParticipant,
  insertRoomWithFirstGame,
  isRoomCodeInUse,
  reactivateParticipant,
} from "./rooms.repository";

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

// Works out who is asking, in the shape the repository stores. Lookup only:
// the guest was made at Welcome, so an unknown token is a 401 and nothing
// is written (decision record 2026-10-18, Q8). Guests only for now — a
// logged-in player will resolve to { guestUserId: null, userId } once login
// exists. If this guest has signed up, their userId rides along.
async function requireKnownGuest(
  guestToken: string,
): Promise<ParticipantOwner> {
  const guest = await findGuestByToken(guestToken);
  if (!guest) {
    throw new HttpException(
      HttpStatus.UNAUTHORIZED,
      "Unknown guest. Continue from the Welcome screen first.",
    );
  }
  return { guestUserId: guest.id, userId: guest.userId };
}

// "Create a room" with the host's setup (decision record 2026-10-18). The
// guest must already exist (Q8), and the mix must be playable for exactly
// the seats it describes (Q9) before anything is saved.
export async function createRoom(
  input: CreateRoomInput,
): Promise<RoomWithCurrentGame> {
  const host = await requireKnownGuest(input.guestToken);

  // The mix decides the room's size, so it's checked against its own total.
  const roleMix = roleMixOf(input.setup);
  const seatCount = capacityOf(input.setup);
  const mixCheck = validateRoleMix(roleMix, seatCount);
  if (!mixCheck.valid) {
    // validateRoleMix's own message, e.g. "A game needs exactly one doctor."
    throw new HttpException(
      HttpStatus.BAD_REQUEST,
      mixCheck.reason ?? "Invalid role mix.",
    );
  }

  const code = await generateRoomCode();
  return insertRoomWithFirstGame(code, host, input.setup);
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
  game: Pick<
    Game,
    "mafiaCount" | "detectiveCount" | "doctorCount" | "townCount"
  >,
): number {
  return (
    game.mafiaCount + game.detectiveCount + game.doctorCount + game.townCount
  );
}

// Adds a guest to a room's open lobby, safe under simultaneous joins. Every
// check runs inside one transaction that holds the room lock (see
// db/room-lock.ts), so two joins can't both see one free seat and both take
// it. The order matters: "already in" is checked before "game started" and
// "full", so a player reconnecting mid-game or to a full lobby gets back in.
// Every failure is thrown (decision record 2026-10-18 validation/errors/
// DTOs). The one exception is an idle lobby: a throw inside the transaction
// would roll back the "abandoned" save, so the transaction returns a marker
// and the throw happens after the commit (Q7).
export async function joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
  const player = await requireKnownGuest(input.guestToken);
  const code = normalizeRoomCode(input.code);

  const outcome = await runInTransaction(
    async (tx): Promise<JoinRoomResult | LobbyExpiry.GAME_ABANDONED> => {
      const lockedRoomId = await lockOpenRoomByCode(tx, code);
      if (!lockedRoomId) {
        throw new HttpException(
          HttpStatus.NOT_FOUND,
          "No open room with that code.",
        );
      }

      const room = await findRoomWithCurrentGame(tx, lockedRoomId);
      const game = room.currentGame;
      // 409, not 404: the room exists, it just can't take anyone right now.
      if (!game) {
        throw new HttpException(
          HttpStatus.CONFLICT,
          "Waiting for the host to start the next game.",
        );
      }
      // Expiry first, like every lobby write (decision record 2026-10-03, Q16).
      if (isGameIdle(game)) {
        await markGameAbandoned(tx, game.id);
        return LobbyExpiry.GAME_ABANDONED;
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
        throw new HttpException(
          HttpStatus.CONFLICT,
          "This game has already begun.",
        );
      }

      // `>=`, not `===`: the Role Mix editor must never let the mix drop below
      // the present count, but if a bug ever lets it, `===` would stop
      // matching and wave everyone in. `>=` still blocks.
      const presentCount = game.participants.filter(
        (participant) => participant.leftAt === null,
      ).length;
      if (presentCount >= capacityOf(game)) {
        throw new HttpException(HttpStatus.CONFLICT, "This room is full.");
      }

      const gameAfterJoin = existingParticipant
        ? await reactivateParticipant(tx, game.id, existingParticipant.id)
        : await insertParticipant(tx, game.id, player);
      return {
        status: JoinRoomStatus.JOINED,
        room: { ...room, currentGame: gameAfterJoin },
      };
    },
  );

  if (outcome === LobbyExpiry.GAME_ABANDONED) {
    // Thrown only now, after the commit. A throw inside the transaction
    // would roll back the "abandoned" save above (Q7).
    throw new HttpException(HttpStatus.CONFLICT, GAME_ABANDONED_MESSAGE);
  }
  return outcome;
}
