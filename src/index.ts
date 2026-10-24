import express from "express";
import {
  errorHandler,
  routeNotFound,
} from "./common/middleware/error.middleware";
import { GAME_ROUTES, GUEST_ROUTES, ROOM_ROUTES } from "./common/routes";
import { env } from "./config/config";
import { gamesRouter } from "./modules/games/games.routes";
import { guestsRouter } from "./modules/guests/guests.routes";
import { roomsRouter } from "./modules/rooms/rooms.routes";

const app = express();
app.use(express.json());
app.use(GUEST_ROUTES.BASE, guestsRouter);
app.use(ROOM_ROUTES.BASE, roomsRouter);
app.use(GAME_ROUTES.BASE, gamesRouter);
// Order matters: unknown URLs fall through the routers to routeNotFound,
// and errorHandler, last, answers every error in the standard shape.
app.use(routeNotFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Mafia backend listening on port ${env.port}`);
});
