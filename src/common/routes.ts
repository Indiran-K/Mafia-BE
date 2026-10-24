// Single source of truth for every route's path string, grouped by module.
// Each <feature>.routes.ts imports its group from here instead of inlining
// path strings, so the same path stays reusable by tests or other modules
// without duplicating it.

// BASE is where each module's router is mounted (index.ts). Every other path
// is relative to it, so the base is written exactly once. Bases are singular
// (/room, /game) by the user's choice.
// The Welcome screen's Continue: creates the guest and hands back its token
// (decision record 2026-10-18, Q2).
export const GUEST_ROUTES = {
  BASE: "/guest",
  CREATE: "/",
} as const;

export const ROOM_ROUTES = {
  BASE: "/room",
  CREATE: "/",
  GET_BY_CODE: "/:code",
  JOIN: "/:code/join",
} as const;

// By game id, not room code, so the host always starts exactly the lobby
// they're looking at (decision record Q18 decision 1).
export const GAME_ROUTES = {
  BASE: "/game",
  START: "/:gameId/start",
  // One night confirm (decision record 2026-10-11).
  NIGHT_ACTION: "/:gameId/night-action",
} as const;
