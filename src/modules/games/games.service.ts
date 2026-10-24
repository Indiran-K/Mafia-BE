import { HttpStatus } from "../../common/enums/http-status.enum";
import { HttpException } from "../../common/exceptions";
import { lockOpenRoomById } from "../../db/room-lock";
import { runInTransaction } from "../../db/transaction";
import {
  NightActionType,
  Phase,
  PlayerStatus,
  Role,
} from "../../game/enums/enums";
import type { NightAction } from "../../game/interfaces/types";
import { isGameIdle } from "../../game/lifecycle/lifecycle";
import {
  NightActionVerdict,
  isMafia,
  playersOnNight,
  validateNightAction,
} from "../../game/night/night";
import { assignRoles, validateRoleMix } from "../../game/roles/roles";
import type { Game, GameParticipant } from "../../generated/prisma/client";
import { findGuestByToken } from "../guests/guests.service";
import { LobbyExpiry, SubmitNightActionStatus } from "./games.enum";
import type {
  ParticipantOwner,
  StartGameInput,
  SubmitNightActionInput,
  SubmitNightActionResult,
} from "./games.interface";
import {
  findGameWithParticipants,
  findNightAction,
  findRoomIdOfGame,
  insertNightAction,
  markGameAbandoned,
  markGameStarted,
  markNightStarted,
  saveParticipantRoles,
  touchGame,
} from "./games.repository";

// Thrown (409) only by the request that expires an idle lobby. Requests
// after it see a game that's simply over and get the normal "no game"
// message, with no lookup of why (decision record 2026-10-18
// validation/errors/DTOs, Q7–Q8). Shared by join and Begin.
export const GAME_ABANDONED_MESSAGE = "Game was abandoned.";

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
    (owner.guestUserId !== null &&
      participant.guestUserId === owner.guestUserId) ||
    (owner.userId !== null && participant.userId === owner.userId)
  );
}

// 404 shared by Begin and both night flows.
function gameNotFoundError(): HttpException {
  return new HttpException(HttpStatus.NOT_FOUND, "No game with that id.");
}

// 409: the game exists, but its state no longer allows a Begin.
function alreadyBegunError(): HttpException {
  return new HttpException(
    HttpStatus.CONFLICT,
    "This game has already begun or ended.",
  );
}

// 403 for an unknown token and for a real guest who isn't the host.
function notHostError(): HttpException {
  return new HttpException(
    HttpStatus.FORBIDDEN,
    "Only the host can begin the game.",
  );
}

// 409 when the phase isn't role reveal (or the room is closed).
function nightAlreadyStartedError(): HttpException {
  return new HttpException(
    HttpStatus.CONFLICT,
    "The night has already started.",
  );
}

// 409 when the game isn't at night (or its room is closed).
function notNightError(): HttpException {
  return new HttpException(HttpStatus.CONFLICT, "It isn't night.");
}

// 403 for an unknown token and for anyone not dealt into this game.
function notInGameError(): HttpException {
  return new HttpException(
    HttpStatus.FORBIDDEN,
    "You aren't playing in this game.",
  );
}

// "Begin the game" (decision record 2026-10-03, Q18). Works out who is
// asking, then runs every check in order inside one transaction that holds
// the room lock, so two Begins pressed at once can't both deal roles — the
// second waits, then sees the game is no longer in LOBBY. Every failure is
// thrown as an HttpException; the one that follows a write (the idle-lobby
// expiry) is thrown after the commit so the write isn't rolled back.
export async function startGame(input: StartGameInput): Promise<Game> {
  // Lookup only (Q19): an unknown token is nobody, so it can't be the host.
  // Answered before any transaction or lock, and no guest is created.
  const guest = await findGuestByToken(input.guestToken);
  if (!guest) throw notHostError();
  const requester = { guestUserId: guest.id, userId: guest.userId };

  const outcome = await runInTransaction(
    async (tx): Promise<Game | LobbyExpiry.GAME_ABANDONED> => {
      const roomId = await findRoomIdOfGame(tx, input.gameId);
      if (!roomId) throw gameNotFoundError();

      // A closed room has no lobby left to start.
      if (!(await lockOpenRoomById(tx, roomId))) throw alreadyBegunError();

      const game = await findGameWithParticipants(tx, input.gameId);
      // Expiry first, like every lobby write (Q18 decision 5).
      if (isGameIdle(game)) {
        await markGameAbandoned(tx, game.id);
        return LobbyExpiry.GAME_ABANDONED;
      }
      if (game.phase !== Phase.LOBBY) throw alreadyBegunError();

      // Only players still in the lobby get a role; anyone who left keeps a
      // null role. The host must be one of them.
      const presentParticipants = game.participants.filter(
        (participant) => participant.leftAt === null,
      );
      const host = presentParticipants.find(
        (participant) => participant.isHost,
      );
      if (!host || !participantBelongsTo(host, requester)) {
        throw notHostError();
      }

      const roleMix = roleMixOf(game);
      const mixCheck = validateRoleMix(roleMix, presentParticipants.length);
      if (!mixCheck.valid) {
        // The host sees validateRoleMix's own message, e.g. "Role mix
        // assigns 5 roles but the room has 4 players."
        throw new HttpException(
          HttpStatus.CONFLICT,
          mixCheck.reason ?? "Invalid role mix.",
        );
      }

      // The rule decides who gets which role; the repository only saves it.
      await saveParticipantRoles(tx, assignRoles(presentParticipants, roleMix));
      return markGameStarted(tx, game.id);
    },
  );

  // Thrown only now, after the commit, so the ABANDONED write stays saved.
  if (outcome === LobbyExpiry.GAME_ABANDONED) {
    throw new HttpException(HttpStatus.CONFLICT, GAME_ABANDONED_MESSAGE);
  }
  return outcome;
}

// The game row stores the mix as four count columns; validateRoleMix and
// assignRoles take it as one object keyed by role. This converts between
// them. The Record<Role, number> return type makes tsc fail if a new role is
// added to the schema and not mapped here. Also used by create room, whose
// setup has the same four fields.
export function roleMixOf(
  game: Pick<
    Game,
    "mafiaCount" | "detectiveCount" | "doctorCount" | "townCount"
  >,
): Record<Role, number> {
  return {
    [Role.MAFIA]: game.mafiaCount,
    [Role.DETECTIVE]: game.detectiveCount,
    [Role.DOCTOR]: game.doctorCount,
    [Role.TOWN]: game.townCount,
  };
}

// Role reveal → night (decision record 2026-10-11, Q10–Q12). No route: the
// reveal timer calls this once Socket.io exists, and tests call it now.
// Holds the room lock, so a timer firing twice still starts the night once.
// Throws an HttpException when there is nothing to start.
export async function startNight(gameId: string): Promise<Game> {
  return runInTransaction(async (tx): Promise<Game> => {
    const roomId = await findRoomIdOfGame(tx, gameId);
    if (!roomId) throw gameNotFoundError();
    if (!(await lockOpenRoomById(tx, roomId))) throw nightAlreadyStartedError();

    const game = await findGameWithParticipants(tx, gameId);
    if (game.phase !== Phase.ROLE_REVEAL) throw nightAlreadyStartedError();
    return markNightStarted(tx, gameId);
  });
}

// A night confirm (decision record 2026-10-11, Q1–Q6, Q9). Checks run in the
// agreed Q2 order inside one transaction holding the room lock, so a confirm
// and the end of the night can never interleave. Reading it top to bottom
// gives the whole flow. Every failure is thrown as an HttpException.
export async function submitNightAction(
  input: SubmitNightActionInput,
): Promise<SubmitNightActionResult> {
  // An unknown token is nobody, so it isn't in the game. Answered before any
  // lock, and no guest is created (same as Begin, Q26).
  const guest = await findGuestByToken(input.guestToken);
  if (!guest) throw notInGameError();
  const requester = { guestUserId: guest.id, userId: guest.userId };

  return runInTransaction(async (tx): Promise<SubmitNightActionResult> => {
    // 1. The game exists.
    const roomId = await findRoomIdOfGame(tx, input.gameId);
    if (!roomId) throw gameNotFoundError();
    if (!(await lockOpenRoomById(tx, roomId))) throw notNightError();
    const game = await findGameWithParticipants(tx, input.gameId);

    // 2–3. It is night, and the night the phone means.
    if (game.phase !== Phase.NIGHT) throw notNightError();
    if (input.round !== game.round) {
      throw new HttpException(HttpStatus.CONFLICT, "That night is over.");
    }

    // 4–5. The requester is a dealt-in player still in the game, and alive.
    const actorRow = game.participants.find(
      (participant) =>
        participant.leftAt === null &&
        participant.role !== null &&
        participantBelongsTo(participant, requester),
    );
    if (!actorRow) throw notInGameError();
    if (actorRow.status !== PlayerStatus.ALIVE) {
      throw new HttpException(
        HttpStatus.FORBIDDEN,
        "Dead players don't act at night.",
      );
    }

    // 6–8. The pure rules: role fits, target valid, role target rules.
    const players = playersOnNight(game.participants, game.round); //! need to check why in findGameWithParticipants itself we are not filtering out the players who have left the game.
    const action: NightAction = {
      actorId: actorRow.id,
      type: input.type,
      targetId: input.targetId,
    };
    const verdict = validateNightAction(players, action); //! Why players just need the player who made action and the target player, not all players in the game.
    if (verdict === NightActionVerdict.ACTION_NOT_ALLOWED) {
      throw new HttpException(HttpStatus.FORBIDDEN, "Your role can't do that.");
    }
    if (verdict === NightActionVerdict.INVALID_TARGET) {
      throw new HttpException(
        HttpStatus.BAD_REQUEST,
        "You can't choose that player.",
      );
    }

    // The detective's answer, given straight away (Q15). Roles never change
    // during a game, so it's safe before the night ends.
    const target = players.find((player) => player.id === action.targetId); //! need to check why again
    const detectiveAnswer =
      action.type === NightActionType.INVESTIGATE && target
        ? isMafia(target)
        : null;

    // 9. A confirm is final (Q1): the same one again is a harmless retry,
    // a different one is refused.
    const earlierConfirm = await findNightAction(
      tx,
      game.id,
      game.round,
      actorRow.id,
    );
    if (earlierConfirm) {
      const sameChoice =
        earlierConfirm.type === action.type &&
        earlierConfirm.targetId === action.targetId;
      if (!sameChoice) {
        throw new HttpException(
          HttpStatus.CONFLICT,
          "You've already made your choice tonight.",
        );
      }
      return {
        status: SubmitNightActionStatus.ALREADY_RECORDED,
        isMafia: detectiveAnswer,
      };
    } //! not able to understand this logic

    await insertNightAction(tx, game.id, game.round, action);
    await touchGame(tx, game.id);
    return {
      status: SubmitNightActionStatus.RECORDED,
      isMafia: detectiveAnswer,
      nightEnded: false,
    };
  });
}
