import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";
import { parse as parseJsonc } from "jsonc-parser";
import { z } from "zod";

// Local D1 sqlite lookup (previously from a helper package): find the
// miniflare sqlite file under .wrangler, initializing it via wrangler if
// this is a fresh checkout.
function getLocalD1Url(): string | null {
  const basePath = path.resolve(".wrangler");
  if (!fs.existsSync(basePath)) {
    console.error(
      "WARNING: .wrangler directory not found. " +
        "The local D1 database is only available after running 'wrangler dev' " +
        "(triggered by running 'npm run dev').",
    );
    return null;
  }
  const findSqliteFile = (): string | undefined =>
    fs
      .readdirSync(basePath, { encoding: "utf-8", recursive: true })
      .find((f) => f.endsWith(".sqlite"));
  let dbFile = findSqliteFile();
  if (!dbFile) {
    const wranglerConfig = z
      .looseObject({
        d1_databases: z
          .array(z.looseObject({ database_name: z.string().optional() }))
          .optional(),
      })
      .safeParse(
        parseJsonc(fs.readFileSync(path.resolve("wrangler.jsonc"), "utf-8")),
      );
    const databaseName = wranglerConfig.success
      ? wranglerConfig.data.d1_databases?.[0]?.database_name
      : undefined;
    if (!databaseName) {
      throw new Error(
        "Could not find database_name in wrangler.jsonc d1_databases configuration",
      );
    }
    console.log(`Initializing local D1 database: ${databaseName}...`);
    execSync(
      `npx wrangler d1 execute ${databaseName} --local --command "SELECT 1;"`,
      { stdio: "pipe" },
    );
    dbFile = findSqliteFile();
    if (!dbFile) {
      throw new Error(
        "Failed to initialize local D1 database. The sqlite file was not created.",
      );
    }
  }
  return path.resolve(basePath, dbFile);
}

const localUrl = getLocalD1Url();

export default defineConfig({
  dialect: "sqlite",
  // The raw SQLite barrel (not ../schema, the provider-aware one, which imports
  // cloudflare:workers and can't load under drizzle-kit's node runtime).
  schema: "./src/db/d1/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: localUrl || "", // Empty fallback for CI/non-dev environments
  },
});
