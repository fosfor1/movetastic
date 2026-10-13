import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E_USERNAME / E2E_PASSWORD come from the gitignored .env (local test user only).
// The app itself reads SUPABASE_* from .dev.vars, which `astro preview` loads on its own.
// In CI the file is absent and the variables come from the job.
if (existsSync(".env")) process.loadEnvFile(".env");

// 4321 is the Astro default for `astro preview` (astro.config.mjs sets no port).
// E2E_PORT overrides it when that port is taken on this machine.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // Production-like build + preview (workerd via the Cloudflare adapter), on the port above.
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Astro 7 moves `astro preview` into a background daemon when it detects an AI agent;
    // keep it in the foreground so Playwright owns (and stops) the server.
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
  },
});
