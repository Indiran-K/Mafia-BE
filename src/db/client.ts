import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Prisma 7 no longer connects from a bare URL — it needs a driver adapter
// that owns the actual Postgres connection pool.
const adapter = new PrismaPg(process.env.DATABASE_URL as string);

// One client for the whole process. Prisma pools connections internally, so
// creating more than one would waste database connections.
export const prisma = new PrismaClient({ adapter });
