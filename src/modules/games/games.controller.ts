import type { NextFunction, Request, Response } from "express";
import { requireGuestToken } from "../../common/auth";
import { HttpStatus } from "../../common/enums/http-status.enum";
import { SubmitNightActionStatus } from "./games.enum";
import type { GameIdParamsDto, NightActionDto } from "./games.request.dto";
import {
  GameSummaryResponseDto,
  NightActionResponseDto,
} from "./games.response.dto";
import { startGame, submitNightAction } from "./games.service";

// "Begin the game". The params were checked by GameIdParamsDto and every
// failure is thrown by the service, so only the success reply is here. The
// reply is the bare game, no participants, so no roles (Q18 decision 2).
// The `as unknown as` cast: validate() already replaced req.params with a
// GameIdParamsDto, but Express types params as a string dictionary, and a
// typed Request<GameIdParamsDto> doesn't fit the router's handler types.
export async function start(req: Request, res: Response, next: NextFunction) {
  try {
    const guestToken = requireGuestToken(req); //! needs to be re-written once implemented with JWT
    const { gameId } = req.params as unknown as GameIdParamsDto;
    const game = await startGame({ gameId, guestToken });
    res.status(HttpStatus.OK).json(new GameSummaryResponseDto(game));
  } catch (error) {
    next(error);
  }
}

// A night confirm. The shape was checked by NightActionDto; every game rule
// is in the service. A retry of the same confirm gets the same body as the
// first, with 200 instead of 201.
export async function nightAction(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const guestToken = requireGuestToken(req); //! needs to be re-written once implemented with JWT
    const { gameId } = req.params as unknown as GameIdParamsDto; // same cast as start
    const { round, type, targetId } = req.body as NightActionDto;
    const result = await submitNightAction({
      gameId,
      guestToken,
      round,
      type,
      targetId,
    });
    const httpStatus =
      result.status === SubmitNightActionStatus.RECORDED
        ? HttpStatus.CREATED
        : HttpStatus.OK;
    res.status(httpStatus).json(new NightActionResponseDto(result.isMafia));
  } catch (error) {
    next(error);
  }
}
