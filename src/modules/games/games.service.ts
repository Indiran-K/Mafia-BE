import { findGuestByToken } from "../../accounts/account-service";
import { lockOpenRoomById } from "../../db/room-lock";
import { runInTransaction } from "../../db/transaction";
import { Phase, Role } from "../../game/enums/enums";
import { isGameIdle } from "../../game/lifecycle/lifecycle";
import { assignRoles, validateRoleMix } from "../../game/roles/roles";
import type { Game, GameParticipant } from "../../generated/prisma/client";
import { StartGameStatus } from "./games.enum";
import type {
  ParticipantOwner,
  StartGameInput,
  StartGameResult,
} from "./games.interface";
import {
  findGameWithParticipants,
  findRoomIdOfGame,
  markGameAbandoned,
  markGameStarted,
  saveParticipantRoles,
} from "./games.repository";

// True when this participant row belongs to this person, matching on
// whichever id the person has. The `!== null` guards are the point: an
// owner always has one id empty, and without them `null === null` would
// match a logged-in player to a guest's row (e.g. let them pass as a guest
// host). Shared by join (find your own row) and begin (check the host row).
// Lives in the service because it's the games module's own rule about its
// participant rows, not a game rule (decision record 2026-10-09, Q12).
export function participantBelongsTo(
  participant: Pick<GameParticipant, "guestUserId" | "userId">,
  owner: ParticipantOwner,
): boolean {
  return (
    (owner.guestUserId !== null && participant.guestUserId === owner.guestUserId) ||
    (owner.userId !== null && participant.userId === owner.userId)
  );
}

// "Begin the game" (decision record 2026-10-03, Q18). Works out who is
// asking, then runs every check in order inside one transaction that holds
// the room lock, so two Begins pressed at once can't both deal roles — the
// second waits, then sees the game is no longer in LOBBY. Reading it top to
// bottom gives the whole Begin flow.
export async function startGame(input: StartGameInput): Promise<StartGameResult> {
  // Lookup only (Q19): an unknown token is nobody, so it can't be the host.
  // Answered before any transaction or lock, and no guest is created.
  const guest = await findGuestByToken(input.guestToken);
  if (!guest) return { status: StartGameStatus.NOT_HOST };
  const requester = { guestUserId: guest.id, userId: guest.userId };

  return runInTransaction(async (tx): Promise<StartGameResult> => {
    const roomId = await findRoomIdOfGame(tx, input.gameId);
    if (!roomId) return { status: StartGameStatus.GAME_NOT_FOUND };

    // A closed room has no lobby left to start.
    if (!(await lockOpenRoomById(tx, roomId))) {
      return { status: StartGameStatus.NOT_IN_LOBBY };
    }

    const game = await findGameWithParticipants(tx, input.gameId);
    // Expiry first, like every lobby write (Q18 decision 5).
    if (isGameIdle(game)) {
      await markGameAbandoned(tx, game.id);
      return { status: StartGameStatus.NOT_IN_LOBBY };
    }
    if (game.phase !== Phase.LOBBY) {
      return { status: StartGameStatus.NOT_IN_LOBBY };
    }

    // Only players still in the lobby get a role; anyone who left keeps a
    // null role. The host must be one of them.
    const presentParticipants = game.participants.filter(
      (participant) => participant.leftAt === null,
    );
    const host = presentParticipants.find((participant) => participant.isHost);
    if (!host || !participantBelongsTo(host, requester)) {
      return { status: StartGameStatus.NOT_HOST };
    }

    const roleMix = roleMixOf(game);
    const mixCheck = validateRoleMix(roleMix, presentParticipants.length);
    if (!mixCheck.valid) {
      return {
        status: StartGameStatus.INVALID_ROLE_MIX,
        reason: mixCheck.reason ?? "Invalid role mix.",
      };
    }

    // The rule decides who gets which role; the repository only saves it.
    await saveParticipantRoles(tx, assignRoles(presentParticipants, roleMix));
    const startedGame = await markGameStarted(tx, game.id);
    return { status: StartGameStatus.STARTED, game: startedGame };
  });
}

// The game row stores the mix as four count columns; validateRoleMix and
// assignRoles take it as one object keyed by role. This converts between
// them. The Record<Role, number> return type makes tsc fail if a new role is
// added to the schema and not mapped here.
function roleMixOf(
  game: Pick<Game, "mafiaCount" | "detectiveCount" | "doctorCount" | "townCount">,
): Record<Role, number> {
  return {
    [Role.MAFIA]: game.mafiaCount,
    [Role.DETECTIVE]: game.detectiveCount,
    [Role.DOCTOR]: game.doctorCount,
    [Role.TOWN]: game.townCount,
  };
}
