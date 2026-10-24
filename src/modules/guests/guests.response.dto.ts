import type { GuestUser } from "../../generated/prisma/client";

// What POST /guest sends back. The token goes back exactly once, here: the
// phone stores it and sends it as `Authorization: Guest <token>` from then
// on. Fields are copied by hand, so a new GuestUser column is never sent by
// accident (decision record 2026-10-18 validation/errors/DTOs, Q5).
export class GuestResponseDto {
  id: string;
  guestToken: string;
  displayName: string;

  constructor(guest: GuestUser) {
    this.id = guest.id;
    this.guestToken = guest.guestToken;
    this.displayName = guest.displayName;
  }
}
