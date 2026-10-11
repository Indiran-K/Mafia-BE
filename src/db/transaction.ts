import type { Prisma } from "../generated/prisma/client";
import { prisma } from "./client";

// Runs `work` as one all-or-nothing database transaction. Services call this
// so they can own the "lock → check → write" flow without importing the
// Prisma client themselves (decision record 2026-10-09, Q10). Repository
// functions take the `tx` it hands over, so every read and write inside
// shares the transaction — and any room lock taken in it.
export function runInTransaction<Result>(
  work: (tx: Prisma.TransactionClient) => Promise<Result>,
): Promise<Result> {
  return prisma.$transaction(work);
}
