import "dotenv/config";

// The one place the app reads process.env. Every other file imports `env`
// from here, so the full list of settings is visible in one file, and a
// missing required one stops the server at startup instead of failing on
// the first request that needs it.

// Throws at startup when a required variable is missing or empty.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "production";

export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 3000),
  nodeEnv,
  // Only a local server sends a crash's real cause back (decision record
  // 2026-10-18 validation/errors/DTOs, Q9). NODE_ENV not set counts as
  // production, so a deploy that forgets it fails safe.
  isDevelopment: nodeEnv === "development",
} as const;
