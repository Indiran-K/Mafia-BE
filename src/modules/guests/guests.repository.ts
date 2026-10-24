import { prisma } from "../../db/client";
import type { GuestUser } from "../../generated/prisma/client";

// Reads and writes GuestUser rows only. No decisions: the service owns them
// (decision record 2026-10-09, Q9). Neither call needs a transaction, so
// they use the shared client directly.

// One new guest row. guestToken is @unique, so a clash fails instead of
// mixing two people up.
export function insertGuest(guestToken: string, displayName: string): Promise<GuestUser> {
  return prisma.guestUser.create({ data: { guestToken, displayName } });
}

export function findGuestRowByToken(guestToken: string): Promise<GuestUser | null> {
  return prisma.guestUser.findUnique({ where: { guestToken } });
}
