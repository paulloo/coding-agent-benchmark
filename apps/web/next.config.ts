import { config } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";

// The platform keeps a single .env at the repository root. Loading it here
// makes the value available to the Next.js server process in dev, build and
// start without duplicating configuration per app.
config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@cab/core", "@cab/db"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
