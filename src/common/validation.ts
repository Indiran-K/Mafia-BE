// Shared request-body checks for controllers.

// True for a string with at least one non-space character. Also narrows
// `unknown` (req.body fields) to `string` for TypeScript.
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
