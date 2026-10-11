// supabase-js client factories for integration tests. Every client keeps its own in-memory session
// (no persistence, no auto-refresh), so two users in one test file never share auth state.
import { createClient } from "@supabase/supabase-js";
import { inject } from "vitest";

// Unique per test-file run; signUp accounts stay in the local DB, so emails must never repeat.
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = "Integration-Test-Passw0rd!";

export interface TestUser {
  id: string;
  email: string;
  client: ReturnType<typeof createAnonClient>;
}

export function createAnonClient() {
  return createClient(inject("supabaseUrl"), inject("supabaseAnonKey"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Signs up a fresh account and returns a client holding its active session. */
export async function createTestUser(label: string): Promise<TestUser> {
  const client = createAnonClient();
  const email = `it-${runId}-${label}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`createTestUser(${label}): signUp failed: ${error.message}`, { cause: error });
  if (!data.session || !data.user) {
    throw new Error(
      `createTestUser(${label}): signUp returned no session — email confirmations must be off ` +
        "(`enable_confirmations = false` in supabase/config.toml).",
    );
  }
  return { id: data.user.id, email, client };
}
