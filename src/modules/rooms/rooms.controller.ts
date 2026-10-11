import type { Request, Response } from "express";
import { readGuestToken } from "../../common/auth";
import { isNonEmptyString } from "../../common/validation";
import { JoinRoomStatus } from "./rooms.enum";
import { createRoom, getOpenRoomByCode, joinRoom } from "./rooms.service";

export async function create(req: Request, res: Response) {
  const guestToken = readGuestToken(req);
  if (!guestToken) {
    res.status(401).json({ error: "Authorization: Guest <token> header is required." });
    return;
  }
  const { displayName } = req.body;
  if (!isNonEmptyString(displayName)) {
    res.status(400).json({ error: "displayName is required." });
    return;
  }

  const room = await createRoom({ guestToken, displayName });
  res.status(201).json(room);
}

export async function getByCode(req: Request, res: Response) {
  const code = req.params.code;
  if (!isNonEmptyString(code)) {
    res.status(400).json({ error: "Room code is required." });
    return;
  }

  const room = await getOpenRoomByCode(code);
  if (!room) {
    res.status(404).json({ error: "No open room with that code." });
    return;
  }
  res.json(room);
}

// Maps each join outcome to its HTTP status. Switching on `status` lets
// TypeScript know `result.room` only exists on the two success cases.
export async function join(req: Request, res: Response) {
  const guestToken = readGuestToken(req);
  if (!guestToken) {
    res.status(401).json({ error: "Authorization: Guest <token> header is required." });
    return;
  }
  const code = req.params.code;
  const { displayName } = req.body;
  if (!isNonEmptyString(code) || !isNonEmptyString(displayName)) {
    res.status(400).json({ error: "Room code and displayName are required." });
    return;
  }

  const result = await joinRoom({ code, guestToken, displayName });
  switch (result.status) {
    case JoinRoomStatus.JOINED:
      res.status(201).json(result.room);
      return;
    case JoinRoomStatus.ALREADY_JOINED:
      res.status(200).json(result.room);
      return;
    case JoinRoomStatus.ROOM_FULL:
      res.status(409).json({ error: "This room is full." });
      return;
    case JoinRoomStatus.ROOM_NOT_FOUND:
      res.status(404).json({ error: "No open room with that code." });
      return;
    // 409, not 404: the room exists, it just can't take anyone right now.
    case JoinRoomStatus.NO_OPEN_GAME:
      res.status(409).json({ error: "Waiting for the host to start the next game." });
      return;
    case JoinRoomStatus.GAME_IN_PROGRESS:
      res.status(409).json({ error: "This game has already begun." });
      return;
  }
}
