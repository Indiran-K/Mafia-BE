import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

// The Welcome screen's name input allows at most 16 characters (CLAUDE.md).
const MAX_DISPLAY_NAME_LENGTH = 16;

// POST /guest body: Welcome → Continue (decision record 2026-10-18, Q2).
// Trimmed before the length check, so "  Ravi " is saved as "Ravi" and a
// name of only spaces fails as empty.
export class CreateGuestDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, MAX_DISPLAY_NAME_LENGTH)
  displayName!: string;
}
