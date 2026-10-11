import express from "express";
import { GAME_ROUTES, ROOM_ROUTES } from "./common/routes";
import { gamesRouter } from "./modules/games/games.routes";
import { roomsRouter } from "./modules/rooms/rooms.routes";

const app = express();
app.use(express.json());
app.use(ROOM_ROUTES.BASE, roomsRouter);
app.use(GAME_ROUTES.BASE, gamesRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Mafia backend listening on port ${PORT}`);
});
