import type { HttpStatus } from "./enums/http-status.enum";

// The one error a service throws to end a request with a given HTTP status
// (decision record 2026-10-18 validation/errors/DTOs, Q4). The error
// middleware turns it into { statusCode, error: { message, description } },
// so no controller builds an error reply by hand.
// Written by hand, NestJS-style, instead of pulling in NestJS itself.
// message is the short headline; description holds the details, e.g. the
// list of failed fields for a validation error (Q3).
export class HttpException extends Error {
  constructor(
    readonly statusCode: HttpStatus,
    message: string,
    readonly description?: string | string[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}
