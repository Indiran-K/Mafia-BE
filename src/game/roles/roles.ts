import { Role } from "../enums/enums";

// The table sizes a game supports. Shared by the suggested mix and the
// playable-mix check, so the two can't disagree.
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 12;

// Every game has exactly this many doctors and detectives (decision record
// 2026-10-11, Q8). Shared by the suggested mix and the playable-mix check.
export const DOCTOR_COUNT = 1;
export const DETECTIVE_COUNT = 1;

// The suggested mix for a table of this size: a third mafia, one detective,
// one doctor, the rest town. A starting point the host can edit, not a rule
// the game enforces — validateRoleMix is what decides a mix is playable.
export function defaultCount(numPlayers: number) {
  let mafiaCount;
  let doctorCount;
  let detectiveCount;
  let villagersCount;
  if (numPlayers < MIN_PLAYERS) {
    throw new Error("Not enough players to assign roles.");
  } else if (numPlayers > MAX_PLAYERS) {
    throw new Error("Too many players to assign roles.");
  } else {
    mafiaCount = Math.floor(numPlayers / 3);
    doctorCount = DOCTOR_COUNT;
    detectiveCount = DETECTIVE_COUNT;
    villagersCount = numPlayers - mafiaCount - doctorCount - detectiveCount;
  }

  return {
    [Role.MAFIA]: mafiaCount,
    [Role.DOCTOR]: doctorCount,
    [Role.DETECTIVE]: detectiveCount,
    [Role.TOWN]: villagersCount,
  };
}

// Whether a mix is playable for this many players. Used when a room is
// created (the mix sets the room's size) and again at Begin (the mix must
// match who is present). Checks, in order: the counts add up to the
// players; 5–12 players; exactly one doctor and one detective (decision
// record 2026-10-11 Q8); at least one mafia, and fewer mafia than everyone
// else. The reason is shown to the host as-is.
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
  if (totalPlayers < MIN_PLAYERS || totalPlayers > MAX_PLAYERS) {
    return {
      valid: false,
      reason: `A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    };
  }
  if (
    config[Role.DOCTOR] !== DOCTOR_COUNT ||
    config[Role.DETECTIVE] !== DETECTIVE_COUNT
  ) {
    return {
      valid: false,
      reason: "A game needs exactly one doctor and one detective.",
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
  const MafiaCount = Math.round(totalPlayers / 4);
  if (config[Role.MAFIA] > MafiaCount) {
    return {
      valid: false,
      reason: `Too many mafia for the number of players. It should be equal to ${MafiaCount}.`,
    };
  }
  return { valid: true, reason: null };
}

// Fisher–Yates: every order is equally likely, so no seat is more likely
// to be dealt mafia. Returns a copy; the caller's list is left as it was.
// Private to this file until something other than assignRoles needs it.
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

// Generic so it can deal roles onto anything — in-memory Players or
// GameParticipant rows — without the caller inventing fields it doesn't
// have. Each item comes back unchanged apart from its `role`.
export function assignRoles<T>(
  players: T[],
  config: Record<Role, number>,
  shuffleFn: (items: T[]) => T[] = shuffle,
): (T & { role: Role })[] {
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

  const playersWithRoles: (T & { role: Role })[] = [];
  let roleIndex = 0;
  for (const [role, count] of Object.entries(config) as [Role, number][]) {
    for (let i = 0; i < count; i++) {
      playersWithRoles.push({ ...shuffledPlayers[roleIndex]!, role });
      roleIndex++;
    }
  }

  return playersWithRoles;
}
