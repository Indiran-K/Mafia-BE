import { Role } from "../enums/enums";

// The suggested mix for a table of this size: a third mafia, one detective,
// one doctor, the rest town. A starting point the host can edit, not a rule
// the game enforces — validateRoleMix is what decides a mix is playable.
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
