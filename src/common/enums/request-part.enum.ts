/**
 * Which part of a request the validation middleware checks. The values are
 * the Express request property names. Query strings aren't here: no route
 * takes one yet, and Express 5 makes req.query read-only.
 */
export enum RequestPart {
  BODY = "body",
  PARAMS = "params",
}
