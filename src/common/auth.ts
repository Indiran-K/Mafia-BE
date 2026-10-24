import type { Request } from "express";
import { HttpStatus } from "./enums/http-status.enum";
import { HttpException } from "./exceptions";

// Who is asking travels in one header, never the body (decision record Q28):
//   guest:            Authorization: Guest <guestToken>
//   signed in (later): Authorization: Bearer <jwt>
// One header means a request is always exactly one identity. The Bearer
// branch arrives with login and turns this into the Q27 Requester.

const GUEST_SCHEME = "guest";

// Returns the guest token from `Authorization: Guest <token>`, or null if
// the header is missing, uses another scheme, or has no token. The scheme
// is matched case-insensitively, as HTTP requires.
export function readGuestToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== GUEST_SCHEME || !token) return null;
  return token;
}

// For routes that need a guest: the token, or a 401 the error middleware
// answers. Replaces the same `if (!guestToken)` block in every handler. A
// real auth middleware comes with the auth task (stopgap, 2026-10-07).
export function requireGuestToken(req: Request): string {
  const guestToken = readGuestToken(req);
  if (!guestToken) {
    throw new HttpException(
      HttpStatus.UNAUTHORIZED,
      "Authorization: Guest <token> header is required.",
    );
  }
  return guestToken;
}
