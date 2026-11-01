// Risk #1 (test-plan §2): user B must not read or change user A's workouts, and an anonymous caller must
// not reach them at all. Exercised directly against PostgREST with two real sessions. The owner may update
// and delete its own rows (positive controls below), but never move a row to another owner. RLS denials on
// select/update/delete return 0 rows without an error, so every denial is confirmed by reading A's row as A.
// Because the select policy hides a too-broad update/delete policy from B, catalog checks pin the UPDATE and
// DELETE policy shapes (test-plan F1).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { connectDb } from "./helpers/db";
import { createAnonClient, createTestUser, type TestUser } from "./helpers/supabase";

interface WorkoutRow {
  id: string;
  user_id: string;
  workout_date: string;
  distance_km: number;
  avg_heart_rate: number;
}

const COLUMNS = "id, user_id, workout_date, distance_km, avg_heart_rate";
const A_VALUES = { workout_date: "2026-01-15", distance_km: 12.34, avg_heart_rate: 145 };
// Distinct from A's values, so "A sees no row with B's values" cannot match A's own row.
const B_VALUES = { workout_date: "2026-01-16", distance_km: 77.77, avg_heart_rate: 177 };
// A's second, dedicated row for the owner-delete test; `rowA` stays live for the denial tests.
const A_DISPOSABLE_VALUES = { workout_date: "2026-01-17", distance_km: 5.55, avg_heart_rate: 133 };
// A's dedicated row for the owner-update test, and the values it is corrected to.
const A_EDITABLE_VALUES = { workout_date: "2026-01-18", distance_km: 6.66, avg_heart_rate: 134 };
const A_EDITED_VALUES = { distance_km: 8.88, avg_heart_rate: 138 };
// B's own row for the reassignment test.
const B_OWN_VALUES = { workout_date: "2026-01-19", distance_km: 9.99, avg_heart_rate: 139 };

const sql = connectDb();

interface PolicyRow {
  policyname: string;
  permissive: string;
  roles: string[];
  qual: string | null;
}

interface UpdatePolicyRow extends PolicyRow {
  with_check: string | null;
}

let userA: TestUser;
let userB: TestUser;
let rowA: WorkoutRow;

async function readRowAsA(): Promise<WorkoutRow[]> {
  const { data, error } = await userA.client
    .from("workouts")
    .select(COLUMNS)
    .eq("id", rowA.id)
    .overrideTypes<WorkoutRow[], { merge: false }>();
  expect(error).toBeNull();
  return data ?? [];
}

async function expectRowAUnchanged() {
  expect(await readRowAsA()).toEqual([rowA]);
}

beforeAll(async () => {
  userA = await createTestUser("rls-a");
  userB = await createTestUser("rls-b");
  const { data, error } = await userA.client
    .from("workouts")
    .insert({ ...A_VALUES, user_id: userA.id })
    .select(COLUMNS)
    .single()
    .overrideTypes<WorkoutRow, { merge: false }>();
  if (error) throw new Error(`A could not insert its own workout: ${error.message}`, { cause: error });
  rowA = data;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("workouts RLS: isolation between users", () => {
  test("positive control: A reads its own row with the original values", async () => {
    expect(await readRowAsA()).toEqual([{ id: rowA.id, user_id: userA.id, ...A_VALUES }]);
  });

  test("B selecting A's row by id gets 0 rows", async () => {
    const { data, error } = await userB.client.from("workouts").select("id").eq("id", rowA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("B selecting without a filter does not see A's row", async () => {
    const { data, error } = await userB.client.from("workouts").select("id, user_id");
    expect(error).toBeNull();
    const rows = (data ?? []) as Pick<WorkoutRow, "id" | "user_id">[];
    expect(rows.map((row) => row.id)).not.toContain(rowA.id);
    expect(rows.every((row) => row.user_id === userB.id)).toBe(true);
  });

  test("B inserting a row owned by A is rejected and creates nothing for A", async () => {
    const { error } = await userB.client.from("workouts").insert({ ...B_VALUES, user_id: userA.id });
    expect(error?.code).toBe("42501");

    const { data, error: readError } = await userA.client
      .from("workouts")
      .select("id")
      .eq("distance_km", B_VALUES.distance_km)
      .eq("avg_heart_rate", B_VALUES.avg_heart_rate);
    expect(readError).toBeNull();
    expect(data).toEqual([]);
  });

  test("B updating A's row changes 0 rows and A's values stay intact", async () => {
    const { data, error } = await userB.client
      .from("workouts")
      .update({ distance_km: 199.99 })
      .eq("id", rowA.id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    await expectRowAUnchanged();
  });

  test("B deleting A's row removes 0 rows and A's row still exists", async () => {
    const { data, error } = await userB.client.from("workouts").delete().eq("id", rowA.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    await expectRowAUnchanged();
  });

  test("A deleting its own row removes exactly that row", async () => {
    const { data: inserted, error: insertError } = await userA.client
      .from("workouts")
      .insert({ ...A_DISPOSABLE_VALUES, user_id: userA.id })
      .select("id")
      .single()
      .overrideTypes<Pick<WorkoutRow, "id">, { merge: false }>();
    if (insertError)
      throw new Error(`A could not insert its own workout: ${insertError.message}`, { cause: insertError });

    const { data, error } = await userA.client.from("workouts").delete().eq("id", inserted.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: inserted.id }]);

    const { data: after, error: readError } = await userA.client.from("workouts").select("id").eq("id", inserted.id);
    expect(readError).toBeNull();
    expect(after).toEqual([]);
    await expectRowAUnchanged();
  });

  test("A updating its own row changes exactly that row", async () => {
    const { data: inserted, error: insertError } = await userA.client
      .from("workouts")
      .insert({ ...A_EDITABLE_VALUES, user_id: userA.id })
      .select("id")
      .single()
      .overrideTypes<Pick<WorkoutRow, "id">, { merge: false }>();
    if (insertError)
      throw new Error(`A could not insert its own workout: ${insertError.message}`, { cause: insertError });

    const { data, error } = await userA.client
      .from("workouts")
      .update(A_EDITED_VALUES)
      .eq("id", inserted.id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: inserted.id }]);

    const { data: after, error: readError } = await userA.client
      .from("workouts")
      .select(COLUMNS)
      .eq("id", inserted.id)
      .overrideTypes<WorkoutRow[], { merge: false }>();
    expect(readError).toBeNull();
    expect(after).toEqual([{ id: inserted.id, user_id: userA.id, ...A_EDITABLE_VALUES, ...A_EDITED_VALUES }]);
    await expectRowAUnchanged();
  });

  test("B moving its own row to A is rejected", async () => {
    const { data: inserted, error: insertError } = await userB.client
      .from("workouts")
      .insert({ ...B_OWN_VALUES, user_id: userB.id })
      .select("id")
      .single()
      .overrideTypes<Pick<WorkoutRow, "id">, { merge: false }>();
    if (insertError)
      throw new Error(`B could not insert its own workout: ${insertError.message}`, { cause: insertError });

    const { error } = await userB.client
      .from("workouts")
      .update({ user_id: userA.id })
      .eq("id", inserted.id)
      .select("id");
    // Pin the RLS denial: any other error must not pass as "rejected". The new row is refused by `with check`
    // and also by the SELECT policy (the update returns the row), so this test alone cannot detect a missing
    // `with check` — the UPDATE policy-shape guard below does.
    expect(error?.code).toBe("42501");

    const { data: after, error: readError } = await userB.client
      .from("workouts")
      .select(COLUMNS)
      .eq("id", inserted.id)
      .overrideTypes<WorkoutRow[], { merge: false }>();
    expect(readError).toBeNull();
    expect(after).toEqual([{ id: inserted.id, user_id: userB.id, ...B_OWN_VALUES }]);
  });

  test("the only UPDATE policy on workouts is the owner check for authenticated (using and with check)", async () => {
    // `ALL` policies also apply to update, so they count as update policies here.
    const policies = await sql<UpdatePolicyRow[]>`
      select policyname, permissive, roles, qual, with_check
      from pg_policies
      where schemaname = 'public' and tablename = 'workouts' and cmd in ('UPDATE', 'ALL')
    `;
    expect([...policies]).toEqual([
      {
        policyname: "workouts_update_own",
        permissive: "PERMISSIVE",
        roles: ["authenticated"],
        qual: "(( SELECT auth.uid() AS uid) = user_id)",
        with_check: "(( SELECT auth.uid() AS uid) = user_id)",
      },
    ]);
  });

  test("the only DELETE policy on workouts is the owner check for authenticated", async () => {
    // `ALL` policies also apply to delete, so they count as delete policies here.
    const policies = await sql<PolicyRow[]>`
      select policyname, permissive, roles, qual
      from pg_policies
      where schemaname = 'public' and tablename = 'workouts' and cmd in ('DELETE', 'ALL')
    `;
    expect([...policies]).toEqual([
      {
        policyname: "workouts_delete_own",
        permissive: "PERMISSIVE",
        roles: ["authenticated"],
        qual: "(( SELECT auth.uid() AS uid) = user_id)",
      },
    ]);
  });
});

describe("workouts RLS: anonymous access", () => {
  test("anonymous select of A's row by id gets 0 rows", async () => {
    const { data, error } = await createAnonClient().from("workouts").select("id").eq("id", rowA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("anonymous insert is rejected", async () => {
    const { error } = await createAnonClient()
      .from("workouts")
      .insert({ ...B_VALUES, user_id: userA.id });
    // Pin the RLS denial: a network, schema or validation error must not pass as "rejected".
    expect(error?.code).toBe("42501");
    await expectRowAUnchanged();
  });
});
