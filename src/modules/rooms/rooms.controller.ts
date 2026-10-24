import type { NextFunction, Request, Response } from "express";
import { requireGuestToken } from "../../common/auth";
import { HttpStatus } from "../../common/enums/http-status.enum";
import { HttpException } from "../../common/exceptions";
import { JoinRoomStatus } from "./rooms.enum";
import type { CreateRoomDto, RoomCodeParamsDto } from "./rooms.request.dto";
import { RoomResponseDto } from "./rooms.response.dto";
import { createRoom, getOpenRoomByCode, joinRoom } from "./rooms.service";

// "Create a room" with the host's setup (decision record 2026-10-18). The
// body was already checked by CreateRoomDto; the guest lookup and the mix
// rules are in the service, which throws on any failure.
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const guestToken = requireGuestToken(req); //! needs to be re-written once implemented with JWT
    const setup = req.body as CreateRoomDto;
    const room = await createRoom({ guestToken, setup });
    res.status(HttpStatus.CREATED).json(new RoomResponseDto(room));
  } catch (error) {
    next(error);
  }
}

// Read-only lookup for the lobby screen. No token needed. A missing room is
// the only failure, and the service returns null for it, so it's thrown here.
// The `as unknown as` cast: validate() already replaced req.params with a
// RoomCodeParamsDto, but Express types params as a string dictionary, and a
// typed Request<RoomCodeParamsDto> doesn't fit the router's handler types.
export async function getByCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { code } = req.params as unknown as RoomCodeParamsDto;
    const room = await getOpenRoomByCode(code);
    if (!room) {
      throw new HttpException(
        HttpStatus.NOT_FOUND,
        "No open room with that code.",
      );
    }
    res.status(HttpStatus.OK).json(new RoomResponseDto(room));
  } catch (error) {
    next(error);
  }
}

// A first join is 201, a repeat by someone already in is 200. Every failure
// is thrown by the service, so only the two successes are told apart here.
export async function join(req: Request, res: Response, next: NextFunction) {
  try {
    const guestToken = requireGuestToken(req); //! needs to be re-written once implemented with JWT
    const { code } = req.params as unknown as RoomCodeParamsDto; // same cast as getByCode
    const result = await joinRoom({ code, guestToken });
    const httpStatus =
      result.status === JoinRoomStatus.JOINED
        ? HttpStatus.CREATED
        : HttpStatus.OK;
    res.status(httpStatus).json(new RoomResponseDto(result.room));
  } catch (error) {
    next(error);
  }
}
