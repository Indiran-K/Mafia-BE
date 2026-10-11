import { prisma } from "../db/client";

// Looks up the guest row for this device. Creates one the first time this
// guestToken is ever seen — after that, the same device always resolves to
// the same GuestUser, signed up or not.
export async function getOrCreateGuest(guestToken: string, displayName: string) {
  const existingGuest = await prisma.guestUser.findUnique({
    where: { guestToken },
  });
  if (existingGuest) return existingGuest;

  return prisma.guestUser.create({
    data: { guestToken, displayName },
  });
}

// Lookup only, never creates. For every action after "entering" (begin,
// leave, vote…): an unknown token is simply nobody, and must not leave a
// junk GuestUser row behind. Guests are meant to be created once, at the
// Welcome screen (decision record Q19).
export async function findGuestByToken(guestToken: string) {
  return prisma.guestUser.findUnique({ where: { guestToken } });
}

// Links a guest to an account. guestUserId is never rewritten, so old games
// still record that a guest played them. We only add userId alongside it.
// If the user is already in a game (e.g. joined from another device), that
// row stays the one that counts — the guest's extra row in that game is left
// as guest-only instead of clashing with the one-row-per-user-per-game rule.
export async function linkGuestToUser(guestUserId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.guestUser.update({
      where: { id: guestUserId },
      data: { userId },
    });

    const gamesAlreadyJoinedAsUser = await tx.gameParticipant.findMany({
      where: { userId },
      select: { gameId: true },
    });
    const joinedGameIds = gamesAlreadyJoinedAsUser.map(
      (participant) => participant.gameId,
    );

    await tx.gameParticipant.updateMany({
      where: { guestUserId, gameId: { notIn: joinedGameIds } },
      data: { userId },
    });

    await tx.room.updateMany({
      where: { createdByGuestUserId: guestUserId },
      data: { createdByUserId: userId },
    });
  });
}
