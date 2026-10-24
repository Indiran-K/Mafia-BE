import { IsIn, IsInt, IsNotEmpty, IsString, Min } from "class-validator";

// The day lengths the room-setup screen offers (decision record 2026-10-18,
// Q4). The database CHECK Game_day_length_check allows the same three.
const DAY_LENGTH_OPTIONS_IN_SECONDS = [60, 120, 180];

// POST /room body: the host's setup (decision record 2026-10-18, Q3–Q4).
// Only the shape is checked here. A count may be 0 at this point; whether
// the mix is playable (one doctor, one detective, 5–12 seats, mafia fewer
// than the rest) is the service's call (Q9).
export class CreateRoomDto {
  @IsInt()
  @Min(0)
  mafiaCount!: number;

  @IsInt()
  @Min(0)
  detectiveCount!: number;

  @IsInt()
  @Min(0)
  doctorCount!: number;

  @IsInt()
  @Min(0)
  townCount!: number;

  @IsIn(DAY_LENGTH_OPTIONS_IN_SECONDS)
  dayLengthInSeconds!: number;
}

// The :code in /room/:code and /room/:code/join. Case and spaces are
// cleaned by the service, so "abc123 " still finds ABC123.
export class RoomCodeParamsDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
