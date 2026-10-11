import { NightActionType, PlayerStatus, Role, TargetStatus } from "../enums/enums";
import type { NightAction, NightOutcome, Player } from "../interfaces/types";

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
