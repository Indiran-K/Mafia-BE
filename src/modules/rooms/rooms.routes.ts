import { Router } from "express";
import { ROOM_ROUTES } from "../../common/routes";
import * as roomsController from "./rooms.controller";

export const roomsRouter = Router();

roomsRouter.post(ROOM_ROUTES.CREATE, roomsController.create);
roomsRouter.get(ROOM_ROUTES.GET_BY_CODE, roomsController.getByCode);
roomsRouter.post(ROOM_ROUTES.JOIN, roomsController.join);
