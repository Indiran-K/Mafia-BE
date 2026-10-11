import type { Request, Response } from "express";
import { readGuestToken } from "../../common/auth";
import { isNonEmptyString } from "../../common/validation";
import { StartGameStatus } from "./games.enum";
import { startGame } from "./games.service";

// "Begin the game". Maps each outcome to its HTTP status. Switching on
// `status` lets TypeScript know `result.game` only exists on STARTED and
// `result.reason` only on INVALID_ROLE_MIX.
export async function start(req: Request, res: Response) {
  const guestToken = readGuestToken(req);
  if (!guestToken) {
    res.status(401).json({ error: "Authorization: Guest <token> header is required." });
    return;
  }
  const gameId = req.params.gameId;
  if (!isNonEmptyString(gameId)) {
    res.status(400).json({ error: "gameId is required." });
    return;
  }

  const result = await startGame({ gameId, guestToken });
  switch (result.status) {
    // The bare game row only — no participants, so no roles (Q18 decision 2).
    case StartGameStatus.STARTED:
      res.status(200).json(result.game);
      return;
    case StartGameStatus.GAME_NOT_FOUND:
      res.status(404).json({ error: "No game with that id." });
      return;
    // 409: the game exists, but its state no longer allows a Begin.
    case StartGameStatus.NOT_IN_LOBBY:
      res.status(409).json({ error: "This game has already begun or ended." });
      return;
    case StartGameStatus.NOT_HOST:
      res.status(403).json({ error: "Only the host can begin the game." });
      return;
    // The host sees validateRoleMix's own message, e.g. "Role mix assigns 5
    // roles but the room has 4 players."
    case StartGameStatus.INVALID_ROLE_MIX:
      res.status(409).json({ error: result.reason });
      return;
  }
}
