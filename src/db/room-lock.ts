import type { Prisma } from "../generated/prisma/client";

// Every lobby write for a room (join, leave, edit mix, begin, play again)
// takes this lock first, inside its transaction. SELECT ... FOR UPDATE makes
// any other transaction that wants the same room row wait until this one
// commits, so their read → check → write steps run one after another
// instead of racing. Kept in one place because it's the rule every write
// path depends on — two hand-copied versions could quietly drift apart.
// Each returns the locked room's id, or null if no open room matches.

export async function lockOpenRoomByCode(
  tx: Prisma.TransactionClient,
  code: string,
): Promise<string | null> {
  const lockedRooms = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Room" WHERE code = ${code} AND "closedAt" IS NULL FOR UPDATE
  `;
  return lockedRooms[0]?.id ?? null;
}

export async function lockOpenRoomById(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<string | null> {
  const lockedRooms = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Room" WHERE id = ${roomId} AND "closedAt" IS NULL FOR UPDATE
  `;
  return lockedRooms[0]?.id ?? null;
}
