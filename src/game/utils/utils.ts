import { NightActionType, PlayerStatus, Role } from "../enums/enums";
import type { NightAction, Player } from "../interfaces/types";

const localCache = new Map<string, any>();

export function defaultCount(numPlayers: number) {
  const minPlayers = 5;
  const maxPlayers = 12;
  let mafiaCount;
  let doctorCount;
  let detectiveCount;
  let villagersCount;
  if (numPlayers < minPlayers) {
    throw new Error("Not enough players to assign roles.");
  } else if (numPlayers > maxPlayers) {
    throw new Error("Too many players to assign roles.");
  } else {
    mafiaCount = Math.floor(numPlayers / 3);
    doctorCount = 1;
    detectiveCount = 1;
    villagersCount = numPlayers - mafiaCount - doctorCount - detectiveCount;
  }

  return {
    [Role.MAFIA]: mafiaCount,
    [Role.DOCTOR]: doctorCount,
    [Role.DETECTIVE]: detectiveCount,
    [Role.TOWN]: villagersCount,
  };
}

// Lets the host's Role Mix editor screen know whether a custom role
// configuration is safe to save, before the game ever starts.
export function validateRoleMix(
  config: Record<Role, number>,
  totalPlayers: number,
): { valid: boolean; reason: string | null } {
  const totalAssignedRoles = Object.values(config).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (totalAssignedRoles !== totalPlayers) {
    return {
      valid: false,
      reason: `Role mix assigns ${totalAssignedRoles} roles but the room has ${totalPlayers} players.`,
    };
  }
  if (config[Role.MAFIA] < 1) {
    return { valid: false, reason: "At least one Mafia is required." };
  }
  const nonMafiaCount = totalPlayers - config[Role.MAFIA];
  if (config[Role.MAFIA] >= nonMafiaCount) {
    return {
      valid: false,
      reason:
        "The mafia already equal the town — they win on night one. Drop to fewer mafia or add seats.",
    };
  }
  return { valid: true, reason: null };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export function assignRoles(
  players: Player[],
  config: Record<Role, number>,
  shuffleFn: <T>(items: T[]) => T[] = shuffle,
): Player[] {
  const totalRoles = Object.values(config).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (totalRoles !== players.length) {
    throw new Error(
      `Role config assigns ${totalRoles} roles but ${players.length} players were given.`,
    );
  }

  const shuffledPlayers = shuffleFn(players);

  const playersWithRoles: Player[] = [];
  let roleIndex = 0;
  for (const [role, count] of Object.entries(config) as [Role, number][]) {
    for (let i = 0; i < count; i++) {
      playersWithRoles.push({ ...shuffledPlayers[roleIndex]!, role });
      roleIndex++;
    }
  }

  return playersWithRoles;
}

export function resolveNightActions(
  gameId: string,
  nightCount: number,
  players: Player[],
  actions: NightAction[],
  role: Role,
) {
  switch (role) {
    case Role.MAFIA: {
      const livingMafiaIds = players
        .filter((player) => player.role === Role.MAFIA && player.status === PlayerStatus.ALIVE)
        .map((player) => player.id);
      resolveMafiaActions(gameId, nightCount, players, actions, livingMafiaIds);
      break;
    }
    case Role.DOCTOR:
      resolveDoctorActions(gameId, nightCount, players, actions);
      break;
    case Role.DETECTIVE:
      resolveDetectiveActions(gameId, nightCount, players, actions);
      break;
    case Role.TOWN:
      break;
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

export function resultNightActions(
  gameId: string,
  nightCount: number,
  players: Player[],
) {
  const mafiaTarget = getTargetPlayer(gameId, nightCount, Role.MAFIA);
  const doctorTarget = getTargetPlayer(gameId, nightCount, Role.DOCTOR);
  const detectiveTarget = getTargetPlayer(gameId, nightCount, Role.DETECTIVE);

  if (isEmpty(mafiaTarget)) {
    console.log(`Night ${nightCount}: Mafia did not select a target to kill.`);
  }

  if (isEmpty(doctorTarget)) {
    console.log(
      `Night ${nightCount}: Doctor did not select a target to protect.`,
    );
  }

  if (isEmpty(detectiveTarget)) {
    console.log(
      `Night ${nightCount}: Detective did not select a target to investigate.`,
    );
  }

  if (mafiaTarget && doctorTarget && mafiaTarget.id === doctorTarget.id) {
    console.log(
      `Night ${nightCount}: Doctor saved the Mafia's target. No one was killed.`,
    );
  } else {
    const killedPlayer: Player | undefined = mafiaTarget;
    if (!isEmpty(killedPlayer)) {
      console.log(
        `Night ${nightCount}: ${killedPlayer?.name} was killed by the Mafia.`,
      );
    } else {
      console.log(`Night ${nightCount}: No one was killed by the Mafia.`);
    }
  }

  if (detectiveTarget) {
    const isMafia = detectiveTarget.role === Role.MAFIA;
    console.log(
      `Night ${nightCount}: Detective investigated ${detectiveTarget.name} (ID: ${detectiveTarget.id}). Result: ${isMafia ? "Mafia" : "Not Mafia"}.`,
    );
  }
}
// Mafia only kill when a strict majority of ALL living mafia — not just
// whoever submitted an action — pick the same thing. A mafia member who
// never submits is treated as choosing "stay silent," same as an explicit
// SKIP action, so a quiet minority can't accidentally tip a kill through,
// and a silent majority can deliberately call off the kill.
const SILENT_CHOICE = "silent";

function resolveMafiaActions(
  gameId: string,
  nightCount: number,
  players: Player[],
  actions: NightAction[],
  livingMafiaIds: string[],
) {
  // Step 1: figure out each living mafia member's choice. Default everyone
  // to silent first, then apply whatever action they actually submitted.
  const choiceByMafiaId: Record<string, string> = {};
  for (const mafiaId of livingMafiaIds) {
    choiceByMafiaId[mafiaId] = SILENT_CHOICE;
  }
  for (const action of actions) {
    if (action.type === NightActionType.KILL) {
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
    console.log(
      `Night ${nightCount}: Mafia did not reach a majority to kill — no one was killed.`,
    );
    return;
  }

  const targetPlayer = players.find((player) => player.id === winningChoice);
  console.log(
    `Night ${nightCount}: Mafia targeted ${targetPlayer?.name} (ID: ${targetPlayer?.id}) for killing.`,
  );
  saveTargetPlayer(gameId, nightCount, Role.MAFIA, targetPlayer);
}

function resolveDoctorActions(
  gameId: string,
  nightCount: number,
  players: Player[],
  actions: NightAction[],
) {
  const doctorActions = actions.filter(
    (action) => action.type === NightActionType.PROTECT,
  );
  if (doctorActions.length === 0) {
    console.log(`Night ${nightCount}: Doctor skipped their protect action.`);
    return;
  }
  const targetPlayer = players.find(
    (player) => player.id === doctorActions[0]?.targetId,
  );
  console.log(
    `Night ${nightCount}: Doctor protected ${targetPlayer?.name} (ID: ${targetPlayer?.id}).`,
  );
  saveTargetPlayer(gameId, nightCount, Role.DOCTOR, targetPlayer);
}

function resolveDetectiveActions(
  gameId: string,
  nightCount: number,
  players: Player[],
  actions: NightAction[],
) {
  const detectiveActions = actions.filter(
    (action) => action.type === NightActionType.INVESTIGATE,
  );
  if (detectiveActions.length === 0) {
    console.log(
      `Night ${nightCount}: Detective skipped their investigate action.`,
    );
    return;
  }
  const targetPlayer = players.find(
    (player) => player.id === detectiveActions[0]?.targetId,
  );
  console.log(
    `Night ${nightCount}: Detective investigated ${targetPlayer?.name} (ID: ${targetPlayer?.id}).`,
  );
  saveTargetPlayer(gameId, nightCount, Role.DETECTIVE, targetPlayer);
  const isMafia = targetPlayer?.role === Role.MAFIA;
  console.log(
    `Night ${nightCount}: Detective's investigation result: ${targetPlayer?.name} is ${isMafia ? "Mafia" : "Not Mafia"}.`,
  );
}

function saveTargetPlayer(
  gameId: string,
  nightCount: number,
  role: Role,
  player: Player | undefined,
) {
  const key = `${gameId}-${nightCount}-${role}`;
  localCache.set(key, player);
}

function getTargetPlayer(
  gameId: string,
  nightCount: number,
  role: Role,
): Player | undefined {
  const key = `${gameId}-${nightCount}-${role}`;
  return localCache.get(key);
}

function isEmpty(value: any): boolean {
  // 1. Check for Null or Undefined
  if (value == null) {
    return true;
  }

  // 2. Check for Booleans and Numbers (Never considered empty)
  if (typeof value === "boolean" || typeof value === "number") {
    return false;
  }

  // 3. Check for Strings
  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  // 4. Check for Arrays
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  // 5. Check for Built-in Collections (Map & Set)
  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  // 6. Check for Plain Objects
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  // Default fallback for unhandled types (like functions or symbols)
  return false;
}
