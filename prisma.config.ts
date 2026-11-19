import "dotenv/config";
import { defineConfig } from "prisma/config";

// process.env is used instead of env() because `prisma generate` must work
// without a database connection (CI typecheck, container builds).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
