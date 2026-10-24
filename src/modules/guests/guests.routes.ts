import { Router } from "express";
import { RequestPart } from "../../common/enums/request-part.enum";
import { validate } from "../../common/middleware/validate.middleware";
import { GUEST_ROUTES } from "../../common/routes";
import * as guestsController from "./guests.controller";
import { CreateGuestDto } from "./guests.request.dto";

export const guestsRouter = Router();

guestsRouter.post(
  GUEST_ROUTES.CREATE,
  validate(CreateGuestDto, RequestPart.BODY),
  guestsController.create,
);
