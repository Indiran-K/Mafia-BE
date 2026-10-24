import { plainToInstance, type ClassConstructor } from "class-transformer";
import { validate as runValidation, type ValidationError } from "class-validator";
import type { NextFunction, Request, Response } from "express";
import { RequestPart } from "../enums/request-part.enum";
import { HttpStatus } from "../enums/http-status.enum";
import { HttpException } from "../exceptions";

// Request validation as route middleware (decision record 2026-10-18
// validation/errors/DTOs, Q2): a request that fails its DTO never reaches
// the controller, and the controller reads req.body / req.params as the
// already-checked DTO.

// Every failed rule's message, nested DTOs included, so the phone sees all
// problems at once instead of fixing one field per request.
function messagesOf(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messagesOf(error.children ?? []),
  ]);
}

// One middleware for any part of the request, e.g.
//   router.post(path, validate(CreateRoomDto, RequestPart.BODY), create)
// It builds the DTO from the raw input and checks it, then puts the DTO back
// in place of the raw input. whitelist drops fields the DTO doesn't declare
// (an older phone's extra field is ignored, not refused). No implicit
// conversion: "2" stays a string and fails @IsInt(). Any failure goes to
// the error middleware through next(error).
export function validate<T extends object>(
  dtoClass: ClassConstructor<T>,
  part: RequestPart,
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const dto = plainToInstance(dtoClass, req[part] ?? {});
      const errors = await runValidation(dto, { whitelist: true });
      if (errors.length > 0) {
        throw new HttpException(
          HttpStatus.BAD_REQUEST,
          "Validation failed",
          messagesOf(errors),
        );
      }
      req[part] = dto;
      next();
    } catch (error) {
      next(error);
    }
  };
}
