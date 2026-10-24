import type { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../../common/enums/http-status.enum";
import type { CreateGuestDto } from "./guests.request.dto";
import { GuestResponseDto } from "./guests.response.dto";
import { createGuest } from "./guests.service";

// Welcome → Continue (decision record 2026-10-18, Q2). No Authorization
// header: this is the call that hands the phone its token. Every call makes
// a new guest, so the phone calls it once and keeps the token. The body was
// already checked and trimmed by CreateGuestDto.
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { displayName } = req.body as CreateGuestDto;
    const guest = await createGuest(displayName);
    res.status(HttpStatus.CREATED).json(new GuestResponseDto(guest));
  } catch (error) {
    next(error);
  }
}
