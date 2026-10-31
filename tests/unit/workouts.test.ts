// Id guard for the workout service: a malformed id is treated as not found and never reaches Postgres (22P02).
// Expected values are written as literals per row.
import { describe, expect, test } from "vitest";

import { isUuid } from "@/lib/workouts";

describe("isUuid", () => {
  test.each<[string, boolean]>([
    ["3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c", true],
    ["3F2B8C1E-9A4D-4E7B-8C2A-1D5E6F7A8B9C", true],
    ["00000000-0000-0000-0000-000000000000", true],
    ["", false],
    ["abc", false],
    ["3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9cx", false],
    [" 3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c ", false],
  ])("isUuid(%j) is %s", (id, expected) => {
    expect(isUuid(id)).toBe(expected);
  });
});
