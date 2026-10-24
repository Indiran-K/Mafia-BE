import { NightActionType, PlayerStatus, Role, TargetStatus } from "../enums/enums";
import type { NightAction, NightOutcome, NightPlayer, Player } from "../interfaces/types";

// Which action types each role may confirm at night. Town has none, so town
// never acts and is never waited for. Every night role may also skip (Q5).
const ACTIONS_BY_ROLE: Record<Role, readonly NightActionType[]> = {
  [Role.MAFIA]: [NightActionType.KILL, NightActionType.SKIP],
  [Role.DOCTOR]: [NightActionType.PROTECT, NightActionType.SKIP],
  [Role.DETECTIVE]: [NightActionType.INVESTIGATE, NightActionType.SKIP],
  [Role.TOWN]: [],
};

// Why a confirm was refused, so the service can pick the HTTP status:
// ACTION_NOT_ALLOWED → 403 (wrong role), INVALID_TARGET → 400 (bad target).
export enum NightActionVerdict {
  OK = "ok",
  ACTION_NOT_ALLOWED = "action_not_allowed",
  INVALID_TARGET = "invalid_target",
}

// The detective's answer, and the one place that says what "is mafia" means.
// Takes a nullable role so a database row's target can be passed straight in.
export function isMafia(player: { role: Role | null }): boolean {
  return player.role === Role.MAFIA;
}

// Checks 6–8 of the submit order (decision record 2026-10-11, Q2): the
// action fits the actor's role, the target is a living player in this game,
// and the role's own target rules hold (Q3 mafia never target mafia; the
// detective never targets themselves; the doctor may protect anyone, Q4).
// Checks 1–5 and 9 need the database, so the service does them.
export function validateNightAction(
  players: NightPlayer[],
  action: NightAction,
): NightActionVerdict {
  const actor = players.find((player) => player.id === action.actorId);
  if (!actor || !ACTIONS_BY_ROLE[actor.role].includes(action.type)) {
    return NightActionVerdict.ACTION_NOT_ALLOWED;
  }

  if (action.type === NightActionType.SKIP) {
    return action.targetId === null ? NightActionVerdict.OK : NightActionVerdict.INVALID_TARGET;
  }

  const target = players.find((player) => player.id === action.targetId);
  if (!target || target.status !== PlayerStatus.ALIVE) {
    return NightActionVerdict.INVALID_TARGET;
  }
  if (isMafia(actor) && isMafia(target)) return NightActionVerdict.INVALID_TARGET;
  if (actor.role === Role.DETECTIVE && target.id === actor.id) {
    return NightActionVerdict.INVALID_TARGET;
  }
  return NightActionVerdict.OK;
}

// Who was in the game, and alive, on night `round`. A player counts as alive
// on every night up to and including the round they died (they died that
// night, or on a later day). So recomputing an old night still counts a
// mafia who was voted out afterwards (Q16). Anyone never dealt a role (left
// the lobby before Begin) isn't part of the game at all.
export function playersOnNight(
  participants: {
    id: string;
    role: Role | null;
    status: PlayerStatus;
    diedAtRound: number | null;
  }[],
  round: number,
): NightPlayer[] {
  const players: NightPlayer[] = [];
  for (const participant of participants) {
    if (participant.role === null) continue;
    const aliveOnNight =
      participant.status === PlayerStatus.ALIVE ||
      (participant.diedAtRound !== null && participant.diedAtRound >= round);
    players.push({
      id: participant.id,
      role: participant.role,
      status: aliveOnNight ? PlayerStatus.ALIVE : PlayerStatus.DEAD,
    });
  }
  return players;
}

// Resolves one role's actions for the night and hands back that role's
// target. Town has no night action, so it never has a target.
export function resolveNightActions(
  players: Player[],
  actions: NightAction[],
  role: Role,
): Player | undefined {
  switch (role) {
    case Role.MAFIA: {
      const livingMafiaIds = players
        .filter((player) => player.role === Role.MAFIA && player.status === PlayerStatus.ALIVE)
        .map((player) => player.id);
      return resolveMafiaActions(players, actions, livingMafiaIds);
    }
    case Role.DOCTOR:
      return resolveDoctorActions(players, actions);
    case Role.DETECTIVE:
      return resolveDetectiveActions(players, actions);
    case Role.TOWN:
      return undefined;
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

// Turns each role's target into the night's outcome. The doctor only saves
// someone by protecting exactly the mafia's target. Takes one object, not
// three positional players, so a caller can't swap two targets by accident.
export function combineNightResults(targets: {
  mafiaTarget: Player | undefined;
  doctorTarget: Player | undefined;
  detectiveTarget: Player | undefined;
}): NightOutcome {
  const { mafiaTarget, doctorTarget, detectiveTarget } = targets;

  let mafiaTargetStatus: TargetStatus | null = null;
  if (mafiaTarget) {
    mafiaTargetStatus =
      mafiaTarget.id === doctorTarget?.id
        ? TargetStatus.SAVED
        : TargetStatus.KILLED;
  }

  return {
    mafiaTargetId: mafiaTarget?.id ?? null,
    mafiaTargetStatus,
    doctorProtectedId: doctorTarget?.id ?? null,
    investigation: detectiveTarget
      ? {
          targetId: detectiveTarget.id,
          isMafia: detectiveTarget.role === Role.MAFIA,
        }
      : null,
  };
}

// Mafia only kill when a strict majority of ALL living mafia — not just
// whoever submitted an action — pick the same thing. A mafia member who
// never submits is treated as choosing "stay silent," same as an explicit
// SKIP action, so a quiet minority can't accidentally tip a kill through,
// and a silent majority can deliberately call off the kill.
const SILENT_CHOICE = "silent";

function resolveMafiaActions(
  players: Player[],
  actions: NightAction[],
  livingMafiaIds: string[],
): Player | undefined {
  // Step 1: figure out each living mafia member's choice. Default everyone
  // to silent first, then apply whatever action they actually submitted.
  // A KILL with no target can't name anyone, so it leaves them silent.
  const choiceByMafiaId: Record<string, string> = {};
  for (const mafiaId of livingMafiaIds) {
    choiceByMafiaId[mafiaId] = SILENT_CHOICE;
  }
  for (const action of actions) {
    if (action.type === NightActionType.KILL && action.targetId !== null) {
      choiceByMafiaId[action.actorId] = action.targetId;
    } else if (action.type === NightActionType.SKIP) {
      choiceByMafiaId[action.actorId] = SILENT_CHOICE;
    }
  }

  // Step 2: count how many mafia landed on each choice.
  const voteCountByChoice: Record<string, number> = {};
  for (const mafiaId of livingMafiaIds) {
    const choice = choiceByMafiaId[mafiaId]!;
    voteCountByChoice[choice] = (voteCountByChoice[choice] || 0) + 1;
  }

  // Step 3: a choice only wins if strictly more than half of all living
  // mafia picked it. Anything less (including an exact half-half split)
  // fails to reach a majority.
  const majorityThreshold = livingMafiaIds.length / 2;
  let winningChoice: string | null = null;
  for (const choice of Object.keys(voteCountByChoice)) {
    if (voteCountByChoice[choice]! > majorityThreshold) {
      winningChoice = choice;
    }
  }

  if (winningChoice === null || winningChoice === SILENT_CHOICE) {
    return undefined;
  }

  return players.find((player) => player.id === winningChoice);
}

// The doctor's protect target, or undefined if they skipped. Whether it
// actually saved anyone is decided later, against the mafia's target.
function resolveDoctorActions(
  players: Player[],
  actions: NightAction[],
): Player | undefined {
  const protectAction = actions.find(
    (action) => action.type === NightActionType.PROTECT,
  );
  return players.find((player) => player.id === protectAction?.targetId);
}

// The detective's investigate target, or undefined if they skipped. The
// "is this player mafia?" answer is worked out when the night is combined.
function resolveDetectiveActions(
  players: Player[],
  actions: NightAction[],
): Player | undefined {
  const investigateAction = actions.find(
    (action) => action.type === NightActionType.INVESTIGATE,
  );
  return players.find((player) => player.id === investigateAction?.targetId);
}
