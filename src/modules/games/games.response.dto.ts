import type { Game, GameParticipant } from "../../generated/prisma/client";
import type { GameWithParticipants } from "./games.interface";

// Reply shapes for games and their players. Plain classes that copy each
// field by hand (decision record 2026-10-18 validation/errors/DTOs, Q5): a
// field that isn't copied is never sent, and a renamed column breaks tsc.

// One player as everyone in the room sees them. `role` is never copied:
// these replies go to every player, and anyone with the room code can read
// GET /room/:code, so copying it would show who the mafia is (the role
// leak, fixed here). guestUserId/userId let a phone find its own row.
export class ParticipantResponseDto {
  id: string;
  guestUserId: string | null;
  userId: string | null;
  isHost: boolean;
  status: GameParticipant["status"];
  joinedAt: Date;
  leftAt: Date | null;

  constructor(participant: GameParticipant) {
    this.id = participant.id;
    this.guestUserId = participant.guestUserId;
    this.userId = participant.userId;
    this.isHost = participant.isHost;
    this.status = participant.status;
    this.joinedAt = participant.joinedAt;
    this.leftAt = participant.leftAt;
  }
}

// A game without its players. Begin's reply: the host gets no participant
// list there (2026-10-03 Q18 decision 2).
export class GameSummaryResponseDto {
  id: string;
  sequence: number;
  phase: Game["phase"];
  round: number;
  mafiaCount: number;
  detectiveCount: number;
  doctorCount: number;
  townCount: number;
  dayLengthInSeconds: number;
  nightLengthInSeconds: number;
  createdAt: Date;
  startedAt: Date | null;

  constructor(game: Game) {
    this.id = game.id;
    this.sequence = game.sequence;
    this.phase = game.phase;
    this.round = game.round;
    this.mafiaCount = game.mafiaCount;
    this.detectiveCount = game.detectiveCount;
    this.doctorCount = game.doctorCount;
    this.townCount = game.townCount;
    this.dayLengthInSeconds = game.dayLengthInSeconds;
    this.nightLengthInSeconds = game.nightLengthInSeconds;
    this.createdAt = game.createdAt;
    this.startedAt = game.startedAt;
  }
}

// A game with its players, as the lobby shows it.
export class GameResponseDto extends GameSummaryResponseDto {
  participants: ParticipantResponseDto[];

  constructor(game: GameWithParticipants) {
    super(game);
    this.participants = game.participants.map(
      (participant) => new ParticipantResponseDto(participant),
    );
  }
}

// A night confirm's reply. The detective's answer is the only field ever
// sent, and only when there is one, so no other player's role can leak.
export class NightActionResponseDto {
  isMafia?: boolean;

  constructor(isMafia: boolean | null) {
    if (isMafia !== null) this.isMafia = isMafia;
  }
}
