// Integration global setup: runs once per `vitest run`. Reads local Supabase coordinates from the CLI,
// checks that Supabase API, Postgres and the app server answer, and fails loudly (never skips) otherwise.
import { execSync } from "node:child_process";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

const START_SUPABASE = "Start it with `npx supabase start` (needs Docker).";

function readSupabaseStatus(): Record<string, string> {
  let output: string;
  try {
    // The CLI writes WARN lines to stderr; only stdout carries the KEY="value" pairs.
    output = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error(
      `Integration setup: \`npx supabase status\` failed — local Supabase is not running. ${START_SUPABASE}`,
      {
        cause: error,
      },
    );
  }
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
}

function requireValue(values: Record<string, string>, key: string): string {
  const value = values[key];
  if (!value) {
    throw new Error(`Integration setup: \`npx supabase status -o env\` did not report ${key}. ${START_SUPABASE}`);
  }
  return value;
}

async function checkSupabaseApi(supabaseUrl: string, anonKey: string) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: anonKey } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`Integration setup: Supabase API at ${supabaseUrl} is not healthy. ${START_SUPABASE}`, {
      cause: error,
    });
  }
}

async function checkPostgres(dbUrl: string) {
  const sql = postgres(dbUrl, { max: 1, connect_timeout: 5, onnotice: () => undefined });
  try {
    await sql`select 1`;
  } catch (error) {
    throw new Error(`Integration setup: Postgres at ${dbUrl} is not reachable. ${START_SUPABASE}`, { cause: error });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function checkAppServer(baseUrl: string) {
  try {
    // Any HTTP response (including a redirect) means the server is up.
    await fetch(baseUrl, { redirect: "manual" });
  } catch (error) {
    throw new Error(
      `Integration setup: app server at ${baseUrl} is not reachable. Start it with \`npm run dev\` ` +
        "(or `npm run build && npm run preview`), or point BASE_URL at a running server.",
      { cause: error },
    );
  }
}

export default async function setup(project: TestProject) {
  const status = readSupabaseStatus();
  const supabaseUrl = requireValue(status, "API_URL");
  const supabaseAnonKey = requireValue(status, "ANON_KEY");
  const dbUrl = requireValue(status, "DB_URL");
  const baseUrl = process.env.BASE_URL ?? "http://localhost:4321";

  await checkSupabaseApi(supabaseUrl, supabaseAnonKey);
  await checkPostgres(dbUrl);
  await checkAppServer(baseUrl);

  project.provide("supabaseUrl", supabaseUrl);
  project.provide("supabaseAnonKey", supabaseAnonKey);
  project.provide("dbUrl", dbUrl);
  project.provide("baseUrl", baseUrl);
}
