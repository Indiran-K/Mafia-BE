import {
  GameEndReason as DbGameEndReason,
  Phase as DbPhase,
  PlayerStatus as DbPlayerStatus,
  Role as DbRole,
  Team as DbTeam,
} from "../../generated/prisma/enums";

// The enums stored in the database get their values from schema.prisma
// (decision record Q21). Prisma's generated keys equal the values
// (Role.mafia), so these objects only add uppercase keys on top
// (Role.MAFIA === "mafia"). Each type is exactly Prisma's, so database rows
// pass straight into game logic with no casts or conversion.
//
// `satisfies UppercaseKeysFor<...>` makes tsc fail if a schema value has no
// key here, a key has no schema value, or a key points at the wrong value.
type UppercaseKeysFor<Values extends string> = {
  [Value in Values as Uppercase<Value>]: Value;
};

/** The roles a player can be dealt at the start of a game. */
export const Role = {
  MAFIA: DbRole.mafia,
  DETECTIVE: DbRole.detective,
  DOCTOR: DbRole.doctor,
  TOWN: DbRole.town,
} as const satisfies UppercaseKeysFor<DbRole>;
export type Role = (typeof Role)[keyof typeof Role];

/** Which side a player wins with, and which side won the game. */
export const Team = {
  MAFIA: DbTeam.mafia,
  TOWN: DbTeam.town,
} as const satisfies UppercaseKeysFor<DbTeam>;
export type Team = (typeof Team)[keyof typeof Team];

/**
 * Where the game currently is.
 *
 * This is the single source of truth for the game's lifecycle — there is
 * deliberately no separate "status" field. Two overlapping fields would let
 * you represent impossible states like "ended, but still in the night phase".
 */
export const Phase = {
  LOBBY: DbPhase.lobby,
  ROLE_REVEAL: DbPhase.role_reveal,
  NIGHT: DbPhase.night,
  DAY: DbPhase.day,
  VOTE: DbPhase.vote,
  GAME_OVER: DbPhase.game_over,
} as const satisfies UppercaseKeysFor<DbPhase>;
export type Phase = (typeof Phase)[keyof typeof Phase];

/**
 * Whether a player is still in the game.
 *
 * Kept separate from `connection` — the two are independent. A dead player
 * can still be connected and watching, and a living player can drop off Wi-Fi.
 */
export const PlayerStatus = {
  ALIVE: DbPlayerStatus.alive,
  DEAD: DbPlayerStatus.dead,
} as const satisfies UppercaseKeysFor<DbPlayerStatus>;
export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];

/** Why a game ended. `winner` alone can't describe an abort (nobody won). */
export const GameEndReason = {
  MAFIA_ELIMINATED: DbGameEndReason.mafia_eliminated,
  MAFIA_MAJORITY: DbGameEndReason.mafia_majority,
  ABORTED_ATTRITION: DbGameEndReason.aborted_attrition,
  ABORTED_HOST: DbGameEndReason.aborted_host,
  ABANDONED: DbGameEndReason.abandoned,
} as const satisfies UppercaseKeysFor<DbGameEndReason>;
export type GameEndReason = (typeof GameEndReason)[keyof typeof GameEndReason];

/** What each acting role does during the night. */
export enum NightActionType {
  KILL = "kill",
  INVESTIGATE = "investigate",
  PROTECT = "protect",
  SKIP = "skip",
}

/**
 * What happened to a targeted player once the action resolved. Generic on
 * purpose: today only the mafia's target uses it, but a future role that
 * attacks (e.g. a vigilante) reuses the same values.
 */
export enum TargetStatus {
  KILLED = "killed",
  SAVED = "saved",
}

export enum ConnectionStatus {
  ONLINE = "online",
  RECONNECTING = "reconnecting",
  OFFLINE = "offline",
}
