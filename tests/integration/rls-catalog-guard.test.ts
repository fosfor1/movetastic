// Risk #2 (test-plan §2): a new migration must not silently weaken isolation. Scans pg_catalog for every
// object in `public`; a positive control proves the guard catches a table without RLS and a permissive
// anon policy, inside a transaction that is always rolled back.
import { afterAll, describe, expect, test } from "vitest";
import { connectDb } from "./helpers/db";
import {
  findRlsViolations,
  listPublicTables,
  objectExists,
  RLS_GUARD_ALLOWLIST,
  type Violation,
  withoutAllowlisted,
} from "./helpers/rls-guard";

const sql = connectDb();
const PROBE_PREFIX = "__rls_guard_probe";

class Rollback extends Error {}

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("RLS catalog guard", () => {
  test("scope: the scan sees the migrated public tables", async () => {
    expect(await listPublicTables(sql)).toContain("workouts");
  });

  test("no object in public weakens isolation (outside the allowlist)", async () => {
    expect(withoutAllowlisted(await findRlsViolations(sql))).toEqual([]);
  });

  test("every allowlist entry has a reason and points at an existing object", async () => {
    for (const entry of RLS_GUARD_ALLOWLIST) {
      expect(entry.reason.trim(), `${entry.object} (${entry.rule})`).not.toBe("");
      expect(await objectExists(sql, entry.object), `${entry.object} (${entry.rule})`).toBe(true);
    }
  });

  test("positive control: probes without RLS / with anon `true` policy are detected, then rolled back", async () => {
    let detected: Violation[] = [];
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`create table public.${PROBE_PREFIX} (id int)`);
        await tx.unsafe(`create table public.${PROBE_PREFIX}_policy (id int)`);
        await tx.unsafe(`alter table public.${PROBE_PREFIX}_policy enable row level security`);
        await tx.unsafe(
          `create policy probe_anon_true on public.${PROBE_PREFIX}_policy for select to anon using (true)`,
        );
        detected = await findRlsViolations(tx);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    expect(detected).toEqual(
      expect.arrayContaining([
        { object: PROBE_PREFIX, rule: "rls-disabled" },
        { object: `${PROBE_PREFIX}_policy.probe_anon_true`, rule: "policy-for-anon-or-public" },
        { object: `${PROBE_PREFIX}_policy.probe_anon_true`, rule: "policy-always-true" },
      ]),
    );

    const leftovers = await sql`select relname from pg_class where relname like ${`${PROBE_PREFIX}%`}`;
    expect(leftovers).toHaveLength(0);
  });
});
