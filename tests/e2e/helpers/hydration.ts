import type { Page } from "@playwright/test";

/**
 * Resolves once every Astro island on the page has hydrated. Use it before typing into a form whose
 * submit is not idempotent (it creates data), where a fill + submit retry is not safe.
 */
export async function waitForIslandsHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}
