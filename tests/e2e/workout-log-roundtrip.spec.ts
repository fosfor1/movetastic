// risk: workout-log-roundtrip — a workout logged through the real form (React island → POST /api/workouts
// → RLS-protected DB) must show up in the signed-in runner's "Ostatnie 7 dni" list and survive a reload.
// Not in test-plan.md (its §4 has no e2e layer); chosen by the user for a standalone /10x-e2e run.
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";
import { waitForIslandsHydrated } from "./helpers/hydration";
import { deleteWorkouts } from "./helpers/local-db";

// Unique per run: distance 10.00–99.99 km and heart rate 100–199, both derived from the clock.
const stamp = Date.now();
const distanceKm = Number((10 + (stamp % 9000) / 100).toFixed(2));
const avgHeartRate = 100 + (Math.floor(stamp / 9000) % 100);
const distanceText = distanceKm.toFixed(2).replace(".", ",");

test.describe("workout-log-roundtrip", () => {
  test.afterEach(async () => {
    // Cleanup — asserted: exactly the one workout this test created is removed.
    const username = process.env.E2E_USERNAME ?? "";
    expect(await deleteWorkouts(username, distanceKm, avgHeartRate)).toBe(1);
  });

  test("a workout logged through the form appears in the 7-day list and persists after reload", async ({ page }) => {
    test.info().annotations.push({ type: "test-data", description: `${distanceText} km · ${avgHeartRate} ud/min` });
    const loggedWorkout = page.getByRole("listitem").filter({
      hasText: `${distanceText} km · śr. tętno ${avgHeartRate} ud/min`,
    });

    // Open the form (signed in via storageState) and wait until the island can take input.
    await page.goto("/dashboard/workouts/new");
    await expect(page.getByRole("heading", { name: "Dodaj trening", level: 1 })).toBeVisible();
    await waitForIslandsHydrated(page);

    // Log today's workout (the date field defaults to today in the app's time zone).
    await page.getByLabel("Dystans (km)").fill(distanceText);
    await page.getByLabel("Średnie tętno (ud/min)").fill(String(avgHeartRate));
    await page.getByRole("button", { name: "Zapisz trening" }).click();

    // The runner lands on the dashboard and sees the new workout in the 7-day list.
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Ostatnie 7 dni", level: 2 })).toBeVisible();
    await expect(loggedWorkout).toBeVisible();

    // It is stored, not just echoed: a fresh server render still shows it.
    await page.reload();
    await expect(loggedWorkout).toBeVisible();
  });
});
