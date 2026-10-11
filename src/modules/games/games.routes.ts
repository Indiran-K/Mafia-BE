import { Router } from "express";
import { GAME_ROUTES } from "../../common/routes";
import * as gamesController from "./games.controller";

export const gamesRouter = Router();

gamesRouter.post(GAME_ROUTES.START, gamesController.start);
