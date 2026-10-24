import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
import { NightActionType } from "../../game/enums/enums";

// The :gameId in /game/:gameId/start and /game/:gameId/night-action.
export class GameIdParamsDto {
  @IsString()
  @IsNotEmpty()
  gameId!: string;
}

// POST night-action body. Only the shape is checked here; every game rule is
// in the service. targetId is null for a skip: ValidateIf lets null through,
// while a missing targetId (undefined) still fails the string check.
export class NightActionDto {
  @IsInt()
  @Min(1)
  round!: number;

  @IsEnum(NightActionType)
  type!: NightActionType;

  @ValidateIf((dto: NightActionDto) => dto.targetId !== null)
  @IsString()
  @IsNotEmpty()
  targetId!: string | null;
}
