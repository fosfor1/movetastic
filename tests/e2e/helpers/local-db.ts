// Direct access to the LOCAL Supabase Postgres for E2E cleanup only. Workouts have no delete policy
// and no delete route (editing/removal is outside the MVP), so a test removes its own rows here.
// Coordinates come from the Supabase CLI, like tests/integration/setup/global-setup.ts.
import { execSync } from "node:child_process";
import postgres from "postgres";

let dbUrl: string | undefined;

function localDbUrl(): string {
  if (dbUrl) return dbUrl;
  const output = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const match = /^DB_URL="?([^"\r\n]+)"?$/m.exec(output);
  if (!match)
    throw new Error("E2E cleanup: `npx supabase status -o env` did not report DB_URL. Run `npx supabase start`.");
  const url = match[1];
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error(`E2E cleanup refuses a non-local database: ${url}`);
  dbUrl = url;
  return url;
}

/** Deletes the given user's workouts matching distance + heart rate; returns how many rows were removed. */
export async function deleteWorkouts(email: string, distanceKm: number, avgHeartRate: number): Promise<number> {
  const sql = postgres(localDbUrl(), { max: 1, onnotice: () => undefined });
  try {
    const rows = await sql`
      delete from public.workouts w
      using auth.users u
      where w.user_id = u.id
        and u.email = ${email}
        and w.distance_km = ${distanceKm}
        and w.avg_heart_rate = ${avgHeartRate}
      returning w.id`;
    return rows.length;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
