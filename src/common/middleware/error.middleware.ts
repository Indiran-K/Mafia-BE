import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/config";
import { HttpStatus } from "../enums/http-status.enum";
import { HttpException } from "../exceptions";

// The one error reply shape for every endpoint (decision record 2026-10-18
// validation/errors/DTOs, Q3). description is left out when there's none.
interface ErrorReplyBody {
  statusCode: number;
  error: { message: string; description?: string | string[] };
}

function errorReply(
  statusCode: number,
  message: string,
  description?: string | string[],
): ErrorReplyBody {
  return {
    statusCode,
    error: description === undefined ? { message } : { message, description },
  };
}

// express.json() marks a body it can't parse with this type.
function isJsonParseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "entity.parse.failed"
  );
}

// Registered after every router: a URL no route matched gets the standard
// shape too, instead of Express's HTML page.
export function routeNotFound(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(new HttpException(HttpStatus.NOT_FOUND, "Route not found."));
}

// Registered last. Express 5 sends here anything thrown in a handler,
// async ones included. A thrown HttpException is an expected outcome; any
// other error is a bug or an outage, so it's logged and answered with 500.
// Its real cause is sent back only on a local server (Q9).
// The four parameters are what tells Express this is an error handler.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof HttpException) {
    res
      .status(error.statusCode)
      .json(errorReply(error.statusCode, error.message, error.description));
    return;
  }
  if (isJsonParseError(error)) {
    res
      .status(HttpStatus.BAD_REQUEST)
      .json(errorReply(HttpStatus.BAD_REQUEST, "Malformed JSON body."));
    return;
  }

  console.error(error);
  const details =
    env.isDevelopment && error instanceof Error
      ? [error.message, error.stack ?? ""]
      : undefined;
  res
    .status(HttpStatus.INTERNAL_SERVER_ERROR)
    .json(
      errorReply(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Something went wrong.",
        details,
      ),
    );
}
