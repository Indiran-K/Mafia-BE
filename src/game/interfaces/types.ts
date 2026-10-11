import type {
  ConnectionStatus,
  NightActionType,
  Phase,
  PlayerStatus,
  Role,
  TargetStatus,
  Team,
} from "../enums/enums";

/** A player as the *server* knows them — including their secret role. */
export interface Player {
  id: string;
  name: string;
  role: Role;
  status: PlayerStatus;
  isHost: boolean;
  connection: ConnectionStatus;
  disconnectedAt: number | null;
  seatHoldUntil: number | null;
  joinedAt: number;
}

/** A single role's action for a single night. */
export interface NightAction {
  actorId: string;
  /** null for a SKIP — matches the nullable column the NightAction table will have. */
  targetId: string | null;
  type: NightActionType;
}

/**
 * What one night came to: each role's resolved decision, plus what happened
 * to the mafia's target. The rules work it out and hand it back; the caller
 * saves it. *Why* a field is null (split vote, skip, timer ran out) isn't
 * repeated here — the NightAction rows already hold that.
 */
export interface NightOutcome {
  /** null when the mafia reached no majority, or the majority stayed silent. */
  mafiaTargetId: string | null;
  /** "saved" when the doctor protected the mafia's target. null when there's no target. */
  mafiaTargetStatus: TargetStatus | null;
  /** null when the doctor didn't protect anyone. */
  doctorProtectedId: string | null;
  /** null when the detective skipped. Private — only the detective sees it. */
  investigation: { targetId: string; isMafia: boolean } | null;
}

/**
 * What a detective learned on a given night. Kept for the whole game so a
 * detective can look back at earlier results.
 */
export interface Investigation {
  round: number;
  detectiveId: string;
  targetId: string;
  isMafia: boolean;
}

/** The outcome of resolving one night, revealed to everyone the next day. */
export interface NightResult {
  round: number;
  /** null when nobody died — either the doctor saved the target or no kill was submitted. */
  killedPlayerId: string | null;
  /** true when the doctor protected the mafia's target. */
  wasSaved: boolean;
}

/**
 * The complete server-side truth for one room.
 *
 * NEVER send this to clients — it contains every player's role. Project it
 * into a `GameStateView` per player instead.
 */
export interface GameState {
  roomCode: string;
  hostId: string;
  phase: Phase;
  /** Increments on each new night. Round 1 is the first night. */
  round: number;
  players: Player[];
  /** Cleared at the end of every night. */
  nightActions: NightAction[];
  /**
   * voterId -> targetId. Keying by voter makes double-voting structurally
   * impossible, and keeps the identities the UI needs for live vote badges.
   * Cleared at the end of every vote phase.
   */
  votes: Record<string, string>;
  investigations: Investigation[];
  lastNightResult: NightResult | null;
  winner: Team | null;
  /** Epoch milliseconds. null when the phase has no timer. */
  phaseDeadline: number | null;
  /**
   * Set when the host disconnects and a migration candidate is found.
   * Cleared once migration completes, or if the host reconnects before the
   * deadline. Null the rest of the time.
   */
  hostMigration: { candidateId: string; deadline: number } | null;
  /**
   * accuserId -> the one playerId they currently accuse, or null if they've
   * withdrawn their accusation. A new accusation replaces the old one — this
   * is each accuser's current suspicion, not a history of past guesses.
   * Cleared at the start of each day.
   */
  accusations: Record<string, string | null>;
  /** playerIds who have readied up to move from discussion to the vote. Cleared at the start of each day. */
  readyPlayers: string[];
}

/** Another player as one client is allowed to see them. */
export interface PlayerView {
  id: string;
  name: string;
  status: PlayerStatus;
  isHost: boolean;
  /** null until you're allowed to know — revealed on death, or at game over. */
  role: Role | null;
  connection: ConnectionStatus;
  seatHoldUntil: number | null;
}

/**
 * What a single client receives. Built per player from `GameState`, so two
 * players in the same room get different payloads.
 */
export interface GameStateView {
  roomCode: string;
  phase: Phase;
  round: number;
  phaseDeadline: number | null;
  winner: Team | null;
  /** Your own record — you're always allowed to know everything about yourself. */
  you: Player;
  /** Everyone, including you. Your own entry has `role` filled in. */
  players: PlayerView[];
  lastNightResult: NightResult | null;
  /** voterId -> targetId. Only populated during the vote phase. */
  votes: Record<string, string>;
  /** Only ever populated for the detective, and only with their own results. */
  investigations: Investigation[];
}
