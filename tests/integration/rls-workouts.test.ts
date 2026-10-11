// Risk #1 (test-plan §2): user B must not read or change user A's workouts, and an anonymous caller must
// not reach them at all. Exercised directly against PostgREST with two real sessions. RLS denials on
// select/update/delete return 0 rows without an error, so every denial is confirmed by reading A's row as A.
import { beforeAll, describe, expect, test } from "vitest";
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
    expect(error).not.toBeNull();
    await expectRowAUnchanged();
  });
});
