// Risk: auth-gate-roundtrip — a signed-out visitor must not see /dashboard; they are sent to
// /auth/signin, and signing in through the real form brings them to their dashboard.
// Seed for /10x-e2e: every generated test copies its patterns.
import { test, expect } from "@playwright/test";

// The risk is the signed-out path, so this test opts out of the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out visitor is gated from the dashboard and reaches it after signing in", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error("Set E2E_USERNAME and E2E_PASSWORD (see context/foundation/test-stack.md, ## E2E)");
  }
  const dashboardHeading = page.getByRole("heading", { name: "Twoje treningi", level: 1 });

  // Gate: the protected page redirects and shows none of its content.
  await page.goto("/dashboard");
  await page.waitForURL("**/auth/signin");
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(dashboardHeading).toBeHidden();

  // Roundtrip: sign in through the real form (a React island; retry until hydrated, see auth.setup.ts).
  await expect(async () => {
    await page.getByLabel("Email").fill("");
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password", { exact: true }).fill("");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard", { timeout: 5_000 });
  }).toPass();
  await expect(dashboardHeading).toBeVisible();
  await expect(page.getByText(`Zalogowano jako ${username}`)).toBeVisible();

  // No cleanup: the test creates no data. Do not sign out here — Supabase signs out globally
  // and would revoke the saved session every other spec loads.
});
