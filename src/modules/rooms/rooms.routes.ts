import { Router } from "express";
import { RequestPart } from "../../common/enums/request-part.enum";
import { validate } from "../../common/middleware/validate.middleware";
import { ROOM_ROUTES } from "../../common/routes";
import * as roomsController from "./rooms.controller";
import { CreateRoomDto, RoomCodeParamsDto } from "./rooms.request.dto";

export const roomsRouter = Router();

roomsRouter.post(
  ROOM_ROUTES.CREATE,
  validate(CreateRoomDto, RequestPart.BODY),
  roomsController.create,
);
roomsRouter.get(
  ROOM_ROUTES.GET_BY_CODE,
  validate(RoomCodeParamsDto, RequestPart.PARAMS),
  roomsController.getByCode,
);
roomsRouter.post(
  ROOM_ROUTES.JOIN,
  validate(RoomCodeParamsDto, RequestPart.PARAMS),
  roomsController.join,
);
