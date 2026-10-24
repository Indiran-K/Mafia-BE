import { Router } from "express";
import { RequestPart } from "../../common/enums/request-part.enum";
import { validate } from "../../common/middleware/validate.middleware";
import { GAME_ROUTES } from "../../common/routes";
import * as gamesController from "./games.controller";
import { GameIdParamsDto, NightActionDto } from "./games.request.dto";

export const gamesRouter = Router();

gamesRouter.post(
  GAME_ROUTES.START,
  validate(GameIdParamsDto, RequestPart.PARAMS),
  gamesController.start,
);
gamesRouter.post(
  GAME_ROUTES.NIGHT_ACTION,
  validate(GameIdParamsDto, RequestPart.PARAMS),
  validate(NightActionDto, RequestPart.BODY),
  gamesController.nightAction,
);
