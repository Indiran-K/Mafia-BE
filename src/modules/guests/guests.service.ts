import { randomBytes } from "node:crypto";
import type { GuestUser } from "../../generated/prisma/client";
import { findGuestRowByToken, insertGuest } from "./guests.repository";

// 32 random bytes → a 43-character base64url token. Long and random, so
// nobody can guess or pick another player's token (decision record
// 2026-10-18, Q2). Whether guests move to signed JWTs is decided in the
// auth task (Q11).
const GUEST_TOKEN_BYTES = 32;

// Creates a guest with a server-made token. Never looks anything up first:
// the caller has no token yet, so every call is a new person.
export function createGuest(displayName: string): Promise<GuestUser> {
  const guestToken = randomBytes(GUEST_TOKEN_BYTES).toString("base64url");
  return insertGuest(guestToken, displayName);
}

// Lookup only, never creates. For every action after Welcome (create room,
// join, begin, night confirm…): an unknown token is simply nobody, and must
// not leave a junk GuestUser row behind (2026-10-03 Q19).
export function findGuestByToken(guestToken: string): Promise<GuestUser | null> {
  return findGuestRowByToken(guestToken);
}
