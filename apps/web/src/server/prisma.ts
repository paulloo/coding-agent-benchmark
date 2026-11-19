import { getPrismaClient, type PrismaClient } from "@cab/db";

/**
 * Resolved lazily so Next.js can import route modules during build without an
 * active database connection.
 */
export function getPrisma(): PrismaClient {
  return getPrismaClient();
}
