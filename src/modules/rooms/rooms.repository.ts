import { prisma } from "../../db/client";
import { Phase } from "../../game/enums/enums";
import type { Prisma, Room } from "../../generated/prisma/client";
import type { ParticipantOwner } from "../games/games.interface";
import type {
  GameWithParticipants,
  RoomWithCurrentGame,
  StartingRoleMix,
} from "./rooms.interface";

// Every function here only reads or writes rows. No decisions — the service
// owns the flow and the rules (decision record 2026-10-09, Q9).

// Loads a room's current game — the one that isn't GAME_OVER — with its
// participants. The partial unique index one_open_game_per_room guarantees
// this filter matches at most one game, so finished games never come along.
const CURRENT_GAME_INCLUDE = {
  games: {
    where: { phase: { not: Phase.GAME_OVER } },
    include: { participants: true },
  },
} satisfies Prisma.RoomInclude;

type RoomWithOpenGames = Room & { games: GameWithParticipants[] };

// Turns the 0-or-1-element games array from CURRENT_GAME_INCLUDE into a
// single currentGame field, so callers never have to remember the [0].
function toRoomWithCurrentGame({
  games,
  ...room
}: RoomWithOpenGames): RoomWithCurrentGame {
  return { ...room, currentGame: games[0] ?? null };
}

// Only open rooms count — a closed room's code is free to reuse.
export async function isRoomCodeInUse(code: string): Promise<boolean> {
  const existing = await prisma.room.findFirst({
    where: { code, closedAt: null },
    select: { id: true },
  });
  return existing !== null;
}

// Creates the room, its first game's lobby, and the host's participant row
// in one nested write — Prisma runs it as a single transaction, so a room
// never exists without an open lobby and its host already in it. The same
// owner is both the room's creator and the game's host.
export async function insertRoomWithFirstGame(
  code: string,
  host: ParticipantOwner,
  roleMix: StartingRoleMix,
): Promise<RoomWithCurrentGame> {
  const room = await prisma.room.create({
    data: {
      code,
      createdByGuestUserId: host.guestUserId,
      createdByUserId: host.userId,
      games: {
        create: {
          sequence: 1,
          ...roleMix,
          participants: {
            create: {
              guestUserId: host.guestUserId,
              userId: host.userId,
              isHost: true,
            },
          },
        },
      },
    },
    include: CURRENT_GAME_INCLUDE,
  });
  return toRoomWithCurrentGame(room);
}

// Read-only lookup for the lobby screen, outside any transaction.
export async function findOpenRoomByCode(
  code: string,
): Promise<RoomWithCurrentGame | null> {
  const room = await prisma.room.findFirst({
    where: { code, closedAt: null },
    include: CURRENT_GAME_INCLUDE,
  });
  return room ? toRoomWithCurrentGame(room) : null;
}

// The same room + current game, read inside a transaction. Called after the
// room lock is taken, so what it returns can be trusted for the checks.
export async function findRoomWithCurrentGame(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<RoomWithCurrentGame> {
  const room = await tx.room.findUniqueOrThrow({
    where: { id: roomId },
    include: CURRENT_GAME_INCLUDE,
  });
  return toRoomWithCurrentGame(room);
}

// Adds a new participant row. The join and the activity bump are one write,
// so a game can never gain a player without its idle clock restarting.
export function insertParticipant(
  tx: Prisma.TransactionClient,
  gameId: string,
  player: ParticipantOwner,
): Promise<GameWithParticipants> {
  return tx.game.update({
    where: { id: gameId },
    data: {
      lastActivityAt: new Date(),
      participants: {
        create: { guestUserId: player.guestUserId, userId: player.userId },
      },
    },
    include: { participants: true },
  });
}

// Puts someone who left back in by clearing leftAt on their old row — the
// row holds current state only (null = in now). Same one-write activity
// bump as insertParticipant.
export function reactivateParticipant(
  tx: Prisma.TransactionClient,
  gameId: string,
  participantId: string,
): Promise<GameWithParticipants> {
  return tx.game.update({
    where: { id: gameId },
    data: {
      lastActivityAt: new Date(),
      participants: {
        update: {
          where: { id: participantId, leftAt: { not: null } },
          data: { leftAt: null },
        },
      },
    },
    include: { participants: true },
  });
}
