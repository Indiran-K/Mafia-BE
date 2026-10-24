import { GameResponseDto } from "../games/games.response.dto";
import type { RoomWithCurrentGame } from "./rooms.interface";

// What create room, GET /room/:code and join send back: the room and its
// live game. Built from GameResponseDto, so no player's role is ever in it
// (decision record 2026-10-18 validation/errors/DTOs, Q5). Creator ids and
// closedAt stay server-side.
export class RoomResponseDto {
  id: string;
  code: string;
  createdAt: Date;
  currentGame: GameResponseDto | null;

  constructor(room: RoomWithCurrentGame) {
    this.id = room.id;
    this.code = room.code;
    this.createdAt = room.createdAt;
    this.currentGame = room.currentGame ? new GameResponseDto(room.currentGame) : null;
  }
}
