import { GameEndReason, Phase, Role } from "../../game/enums/enums";
import type { Game, GameParticipant, Prisma } from "../../generated/prisma/client";

// Every function here only reads or writes rows, using the transaction the
// service hands in. No decisions — the service owns the flow and the rules
// (decision record 2026-10-09, Q9).

// Only tells the caller which room to lock. Nothing else is read here,
// because the game may change while the caller waits for that lock.
export async function findRoomIdOfGame(
  tx: Prisma.TransactionClient,
  gameId: string,
): Promise<string | null> {
  const game = await tx.game.findUnique({
    where: { id: gameId },
    select: { roomId: true },
  });
  return game?.roomId ?? null;
}

// The game and everyone who has ever joined it, left or not. Called after
// the room lock is taken, so what it returns can be trusted for the checks.
export function findGameWithParticipants(
  tx: Prisma.TransactionClient,
  gameId: string,
): Promise<Game & { participants: GameParticipant[] }> {
  return tx.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { participants: true },
  });
}

// updateMany with `phase <> GAME_OVER` (not update) so a game something
// else already ended is left alone instead of throwing or being overwritten.
export async function markGameAbandoned(
  tx: Prisma.TransactionClient,
  gameId: string,
): Promise<void> {
  await tx.game.updateMany({
    where: { id: gameId, phase: { not: Phase.GAME_OVER } },
    data: {
      phase: Phase.GAME_OVER,
      endReason: GameEndReason.ABANDONED,
      endedAt: new Date(),
    },
  });
}

// Saves already-dealt roles. One updateMany per role (at most 4 queries)
// instead of one update per player: same result, fewer round trips.
export async function saveParticipantRoles(
  tx: Prisma.TransactionClient,
  dealtParticipants: { id: string; role: Role }[],
): Promise<void> {
  for (const role of Object.values(Role)) {
    const participantIds = dealtParticipants
      .filter((participant) => participant.role === role)
      .map((participant) => participant.id);
    if (participantIds.length === 0) continue;
    await tx.gameParticipant.updateMany({
      where: { id: { in: participantIds } },
      data: { role },
    });
  }
}

// Moves the game out of the lobby. Starting also counts as activity, so the
// idle clock restarts here.
export function markGameStarted(
  tx: Prisma.TransactionClient,
  gameId: string,
): Promise<Game> {
  const now = new Date();
  return tx.game.update({
    where: { id: gameId },
    data: { phase: Phase.ROLE_REVEAL, startedAt: now, lastActivityAt: now },
  });
}
