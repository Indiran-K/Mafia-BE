/**
 * The two ways a join succeeds. Every failure is thrown as an HttpException
 * instead (decision record 2026-10-18 validation/errors/DTOs, Q4); these
 * stay because they get different HTTP codes.
 */
export enum JoinRoomStatus {
  JOINED = "joined", // 201
  // Already in this game, e.g. reconnecting mid-game or a retry. 200.
  ALREADY_JOINED = "already_joined",
}
