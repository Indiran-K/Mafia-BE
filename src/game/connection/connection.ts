import { ConnectionStatus } from "../enums/enums";
import type { Player } from "../interfaces/types";

export const RECONNECT_GRACE_MS = 120_000;

export function markDisconnected(
  player: Player,
  now: number,
  holdDurationMs: number = RECONNECT_GRACE_MS,
): Player {
  if (player.connection !== ConnectionStatus.ONLINE) {
    return player;
  }
  return {
    ...player,
    connection: ConnectionStatus.RECONNECTING,
    disconnectedAt: now,
    seatHoldUntil: now + holdDurationMs,
  };
}

export function markReconnected(player: Player): Player {
  if (player.connection === ConnectionStatus.ONLINE) {
    return player;
  }
  return {
    ...player,
    connection: ConnectionStatus.ONLINE,
    disconnectedAt: null,
    seatHoldUntil: null,
  };
}

export function hasSeatExpired(player: Player, now: number): boolean {
  return (
    player.connection === ConnectionStatus.RECONNECTING &&
    player.seatHoldUntil !== null &&
    now >= player.seatHoldUntil
  );
}

export function forfeitSeat(player: Player): Player {
  return {
    ...player,
    connection: ConnectionStatus.OFFLINE,
    seatHoldUntil: null,
  };
}
