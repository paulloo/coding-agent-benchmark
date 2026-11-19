import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";
export * from "./generated/prisma/enums";

export type PrismaConnection = PrismaClient;

export function createPrismaClient(connectionString?: string): PrismaClient {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start the database with docker compose up -d.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

let singleton: PrismaClient | undefined;

interface PrismaGlobal {
  __cabPrisma?: PrismaClient;
}

/** Reuses a single client across hot reloads and request handlers. */
export function getPrismaClient(): PrismaClient {
  const globalScope = globalThis as typeof globalThis & PrismaGlobal;
  if (!singleton) {
    singleton = globalScope.__cabPrisma ?? createPrismaClient();
    globalScope.__cabPrisma = singleton;
  }
  return singleton;
}
